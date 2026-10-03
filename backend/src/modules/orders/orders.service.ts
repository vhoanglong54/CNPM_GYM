import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MembershipType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductType,
  RoleCode,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { ApiError } from '../../common/api-error.js';
import type { AuthUser } from '../../common/auth.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateOrderDto, PayOrderDto } from './orders.dto.js';

const receiptFontPath = fileURLToPath(
  new URL('../../assets/fonts/DejaVuSans.ttf', import.meta.url),
);

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto, user: AuthUser) {
    if (!user.memberProfileId)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Chỉ hội viên mới có thể mua gói.',
        HttpStatus.FORBIDDEN,
      );
    let product: {
      id: string;
      name: string;
      description: string | null;
      price: unknown;
      isActive: boolean;
    } | null = null;
    if (dto.productType === ProductType.MEMBERSHIP)
      product = await this.prisma.membershipPlan.findUnique({
        where: { id: dto.productId },
      });
    if (dto.productType === ProductType.PT_PACKAGE)
      product = await this.prisma.ptPackage.findUnique({
        where: { id: dto.productId },
      });
    if (!product || !product.isActive)
      throw new ApiError(
        'PRODUCT_UNAVAILABLE',
        'Gói tập hiện không còn khả dụng.',
      );

    const number = `ORD-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return this.prisma.order.create({
      data: {
        orderNumber: number,
        memberId: user.id,
        totalAmount: product.price as number,
        items: {
          create: {
            productType: dto.productType,
            productId: product.id,
            productName: product.name,
            productDescription: product.description,
            unitPrice: product.price as number,
          },
        },
      },
      include: { items: true },
    });
  }

  async list(user: AuthUser) {
    const canSeeAll =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    return this.prisma.order.findMany({
      where: canSeeAll ? {} : { memberId: user.id },
      include: {
        items: true,
        member: { select: { id: true, fullName: true, email: true } },
        payments: { include: { receipt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pay(orderId: string, dto: PayOrderDto, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, member: { include: { memberProfile: true } } },
    });
    if (!order)
      throw new ApiError(
        'ORDER_NOT_FOUND',
        'Không tìm thấy đơn hàng.',
        HttpStatus.NOT_FOUND,
      );
    if (order.status === OrderStatus.PAID)
      throw new ApiError(
        'ORDER_ALREADY_PAID',
        'Đơn hàng này đã được thanh toán.',
        HttpStatus.CONFLICT,
      );
    if (order.status === OrderStatus.CANCELLED || !order.items.length)
      throw new ApiError(
        'ORDER_NOT_PAYABLE',
        'Đơn hàng không hợp lệ để thanh toán.',
      );

    const isStaff =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    if (!isStaff && order.memberId !== user.id)
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền thực hiện thao tác này.',
        HttpStatus.FORBIDDEN,
      );
    if (!isStaff && dto.method !== PaymentMethod.TRANSFER_DEMO)
      throw new ApiError(
        'PAYMENT_METHOD_FORBIDDEN',
        'Hội viên chỉ có thể thanh toán bằng chuyển khoản.',
      );
    if (
      isStaff &&
      dto.method === PaymentMethod.TRANSFER_DEMO &&
      order.memberId !== user.id
    )
      throw new ApiError(
        'PAYMENT_METHOD_FORBIDDEN',
        'Nhân viên xác nhận thu tại quầy bằng phương thức tiền mặt.',
      );
    const memberProfile = order.member.memberProfile;
    if (!memberProfile)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Đơn hàng không có hồ sơ hội viên hợp lệ.',
      );

    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
        });
        if (locked.status === OrderStatus.PAID)
          throw new ApiError(
            'ORDER_ALREADY_PAID',
            'Đơn hàng này đã được thanh toán.',
            HttpStatus.CONFLICT,
          );
        const transactionCode = `PAY-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
        const receiptNumber = `RCT-${Date.now()}-${randomUUID().slice(0, 5).toUpperCase()}`;
        const payment = await tx.payment.create({
          data: {
            orderId,
            transactionCode,
            amount: order.totalAmount,
            method: dto.method,
            status: PaymentStatus.PAID,
            confirmedById: isStaff ? user.id : null,
            receipt: { create: { receiptNumber } },
          },
          include: { receipt: true },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.PAID },
        });

        for (const item of order.items) {
          if (item.productType === ProductType.MEMBERSHIP) {
            const plan = await tx.membershipPlan.findUniqueOrThrow({
              where: { id: item.productId },
            });
            const now = new Date();
            const latestDurationMembership =
              plan.type === MembershipType.DURATION
                ? await tx.memberMembership.findFirst({
                    where: {
                      memberId: memberProfile.id,
                      endDate: { gt: now },
                      plan: { type: MembershipType.DURATION },
                    },
                    orderBy: { endDate: 'desc' },
                  })
                : null;
            const startDate = latestDurationMembership?.endDate ?? now;
            const endDate =
              plan.type === MembershipType.DURATION && plan.durationDays
                ? new Date(startDate.getTime() + plan.durationDays * 86_400_000)
                : null;
            await tx.memberMembership.create({
              data: {
                memberId: memberProfile.id,
                planId: plan.id,
                orderItemId: item.id,
                startDate,
                endDate,
                visitsTotal: plan.visitLimit,
              },
            });
          } else {
            const pkg = await tx.ptPackage.findUniqueOrThrow({
              where: { id: item.productId },
            });
            await tx.memberPtPackage.create({
              data: {
                memberId: memberProfile.id,
                packageId: pkg.id,
                orderItemId: item.id,
                sessionsTotal: pkg.sessionCount,
                expiresAt: new Date(Date.now() + 365 * 86_400_000),
              },
            });
          }
        }
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'CONFIRM_MOCK_PAYMENT',
            entityType: 'Order',
            entityId: order.id,
            metadata: {
              method: dto.method,
              amount: order.totalAmount.toString(),
            },
          },
        });
        return {
          orderId,
          status: OrderStatus.PAID,
          payment,
          receipt: payment.receipt,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async cancel(orderId: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order)
      throw new ApiError(
        'ORDER_NOT_FOUND',
        'Không tìm thấy đơn hàng.',
        HttpStatus.NOT_FOUND,
      );
    const isStaff =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    if (!isStaff && order.memberId !== user.id)
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền thực hiện thao tác này.',
        HttpStatus.FORBIDDEN,
      );
    if (order.status !== OrderStatus.PENDING)
      throw new ApiError(
        'ORDER_NOT_CANCELLABLE',
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán.',
      );
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
  }

  async receipt(orderId: string, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        member: { select: { fullName: true, email: true } },
        payments: {
          where: { status: PaymentStatus.PAID },
          include: { receipt: true },
        },
      },
    });
    if (!order)
      throw new ApiError(
        'ORDER_NOT_FOUND',
        'Không tìm thấy đơn hàng.',
        HttpStatus.NOT_FOUND,
      );
    const isStaff =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    if (!isStaff && order.memberId !== user.id)
      throw new ApiError(
        'FORBIDDEN',
        'Bạn không có quyền thực hiện thao tác này.',
        HttpStatus.FORBIDDEN,
      );
    const payment = order.payments[0];
    if (!payment?.receipt)
      throw new ApiError(
        'RECEIPT_NOT_AVAILABLE',
        'Chưa thể xuất phiếu thu cho đơn hàng này.',
      );
    return { order, payment, receipt: payment.receipt };
  }

  async streamReceipt(orderId: string, user: AuthUser, response: Response) {
    const data = await this.receipt(orderId, user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${data.receipt.receiptNumber}.pdf"`,
    );
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.pipe(response);
    doc
      .fontSize(22)
      .font(receiptFontPath)
      .text('TITAN GYM', { align: 'center' });
    doc.moveDown(0.3).fontSize(15).text('PHIẾU THU', { align: 'center' });
    doc.fillColor('#111827').font(receiptFontPath).moveDown(2);
    doc.text(`Số phiếu: ${data.receipt.receiptNumber}`);
    doc.text(`Mã đơn: ${data.order.orderNumber}`);
    doc.text(
      `Hội viên: ${data.order.member.fullName} (${data.order.member.email})`,
    );
    doc.text(`Ngày thu: ${data.payment.paidAt.toLocaleString('vi-VN')}`);
    doc.text(`Phương thức: ${data.payment.method}`);
    doc.moveDown();
    data.order.items.forEach((item) =>
      doc.text(
        `${item.productName} x${item.quantity}  -  ${Number(item.unitPrice).toLocaleString('vi-VN')} VND`,
      ),
    );
    doc
      .moveDown()
      .font(receiptFontPath)
      .fontSize(14)
      .text(
        `TỔNG: ${Number(data.order.totalAmount).toLocaleString('vi-VN')} VND`,
        { align: 'right' },
      );
    doc
      .moveDown(3)
      .font(receiptFontPath)
      .fontSize(9)
      .fillColor('#6b7280')
      .text('Chứng từ được tạo từ hệ thống quản lý Titan Gym.', {
        align: 'center',
      });
    doc.end();
  }
}
