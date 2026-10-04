import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MembershipType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductType,
  RoleCode,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { ApiError } from '../../common/api-error.js';
import type { AuthUser } from '../../common/auth.types.js';
import { formatAppDateTime } from '../../common/date-time.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CreateOrderDto,
  PayOrderDto,
  RejectPaymentDto,
} from './orders.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const receiptFontPath = fileURLToPath(
  new URL('../../assets/fonts/DejaVuSans.ttf', import.meta.url),
);
const PAYMENT_CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;
const PAYMENT_TRANSACTION_MAX_ATTEMPTS = 3;
const PAYMENT_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable' as const,
  maxWait: 10_000,
  timeout: 20_000,
};
const RETRYABLE_PRISMA_CODES = new Set([
  'P1001',
  'P1002',
  'P2024',
  'P2028',
  'P2034',
]);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateOrderDto, user: AuthUser) {
    if (!user.memberProfileId)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Chỉ hội viên mới có thể mua gói.',
        HttpStatus.FORBIDDEN,
      );
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        if (existing.memberId !== user.id)
          throw new ApiError(
            'ORDER_IDEMPOTENCY_CONFLICT',
            'Khóa xác nhận mua hàng đã được sử dụng.',
            HttpStatus.CONFLICT,
          );
        return existing;
      }
    }
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

    const idempotencyKey = dto.idempotencyKey ?? randomUUID();
    const number = `ORD-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    try {
      return await this.prisma.order.create({
        data: {
          orderNumber: number,
          idempotencyKey,
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.order.findUnique({
          where: { idempotencyKey },
          include: { items: true },
        });
        if (existing?.memberId === user.id) return existing;
      }
      throw error;
    }
  }

  async list(user: AuthUser) {
    const canSeeAll =
      user.roles.includes(RoleCode.OWNER) ||
      user.roles.includes(RoleCode.RECEPTIONIST);
    const orders = await this.prisma.order.findMany({
      where: canSeeAll ? {} : { memberId: user.id },
      include: {
        items: true,
        member: { select: { id: true, fullName: true, email: true } },
        payments: {
          include: {
            receipt: true,
            confirmedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                roles: { select: { role: { select: { code: true } } } },
              },
            },
          },
          orderBy: { requestedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const now = Date.now();
    return orders.map((order) => ({
      ...order,
      payments: order.payments.map((payment) =>
        payment.status === PaymentStatus.AWAITING_CONFIRMATION &&
        payment.expiresAt &&
        payment.expiresAt.getTime() <= now
          ? { ...payment, status: PaymentStatus.EXPIRED }
          : payment,
      ),
    }));
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

    if (order.memberId !== user.id)
      throw new ApiError(
        'PAYMENT_MEMBER_CONFIRMATION_REQUIRED',
        'Hội viên sở hữu đơn phải xác nhận thanh toán trước khi nhân viên có thể thu tiền.',
        HttpStatus.FORBIDDEN,
      );
    if (!order.member.memberProfile)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Đơn hàng không có hồ sơ hội viên hợp lệ.',
      );

    return this.requestPaymentConfirmation(orderId, dto.method, user);
  }

  async confirmPayment(orderId: string, paymentId: string, user: AuthUser) {
    this.assertPaymentStaff(user);
    try {
      return await this.runPaymentTransaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { id: paymentId, orderId },
          include: { order: true, receipt: true },
        });
        if (!payment)
          throw new ApiError(
            'PAYMENT_NOT_FOUND',
            'Không tìm thấy yêu cầu thanh toán.',
            HttpStatus.NOT_FOUND,
          );
        if (
          payment.status === PaymentStatus.EXPIRED ||
          (payment.status === PaymentStatus.AWAITING_CONFIRMATION &&
            payment.expiresAt &&
            payment.expiresAt.getTime() <= Date.now())
        )
          throw new ApiError(
            'PAYMENT_REQUEST_EXPIRED',
            'Yêu cầu thanh toán đã hết hạn. Hội viên cần gửi lại yêu cầu.',
            HttpStatus.CONFLICT,
          );
        if (
          payment.status === PaymentStatus.PAID &&
          payment.order.status === OrderStatus.PAID &&
          payment.receipt
        )
          return {
            orderId,
            status: OrderStatus.PAID,
            payment,
            receipt: payment.receipt,
          };
        if (payment.status !== PaymentStatus.AWAITING_CONFIRMATION)
          throw new ApiError(
            'PAYMENT_STATE_INVALID',
            'Yêu cầu thanh toán này không còn chờ xác nhận.',
            HttpStatus.CONFLICT,
          );
        if (payment.order.status !== OrderStatus.PENDING)
          throw new ApiError(
            'ORDER_NOT_PAYABLE',
            'Đơn hàng không còn ở trạng thái chờ thanh toán.',
            HttpStatus.CONFLICT,
          );

        const now = new Date();
        const receiptNumber = this.createReceiptNumber();
        const paidPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            confirmedById: user.id,
            confirmedAt: now,
            paidAt: now,
            receipt: { create: { receiptNumber } },
          },
          include: { receipt: true },
        });
        await this.activateOrderEntitlements(tx, orderId);
        await this.writePaymentAudit(
          tx,
          user.id,
          'CONFIRM_PAYMENT',
          orderId,
          payment.id,
          payment.amount.toString(),
        );
        await this.notifications.notifyUsers(tx, [payment.order.memberId], {
          type: 'PAYMENT_CONFIRMED',
          title: 'Thanh toán đã được xác nhận',
          message: `Đơn ${payment.order.orderNumber} đã được xác nhận và quyền lợi đã được kích hoạt.`,
          metadata: { orderId, paymentId: payment.id },
        });
        return {
          orderId,
          status: OrderStatus.PAID,
          payment: paidPayment,
          receipt: paidPayment.receipt,
        };
      }, 'confirm payment');
    } catch (error) {
      if (!this.isRetryableTransactionError(error)) throw error;
      try {
        const committed = await this.findCompletedPaymentResult(
          orderId,
          paymentId,
        );
        if (committed) return committed;
      } catch (recoveryError) {
        if (!this.isRetryableTransactionError(recoveryError))
          throw recoveryError;
      }
      throw new ApiError(
        'PAYMENT_CONFIRMATION_TEMPORARILY_UNAVAILABLE',
        'Hệ thống chưa thể khóa giao dịch để xác nhận. Vui lòng chờ vài giây rồi thử lại; yêu cầu thanh toán vẫn được giữ nguyên.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async rejectPayment(
    orderId: string,
    paymentId: string,
    dto: RejectPaymentDto,
    user: AuthUser,
  ) {
    this.assertPaymentStaff(user);
    return this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { id: paymentId, orderId },
          include: { order: { select: { memberId: true, orderNumber: true } } },
        });
        if (!payment)
          throw new ApiError(
            'PAYMENT_NOT_FOUND',
            'Không tìm thấy yêu cầu thanh toán.',
            HttpStatus.NOT_FOUND,
          );
        if (payment.status !== PaymentStatus.AWAITING_CONFIRMATION)
          throw new ApiError(
            'PAYMENT_STATE_INVALID',
            'Yêu cầu thanh toán này không còn chờ xác nhận.',
            HttpStatus.CONFLICT,
          );
        const reason = dto.reason.trim();
        if (reason.length < 3)
          throw new ApiError(
            'PAYMENT_REJECTION_REASON_REQUIRED',
            'Vui lòng nhập lý do từ chối rõ ràng.',
          );
        const rejected = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REJECTED,
            confirmedById: user.id,
            rejectedAt: new Date(),
            rejectionReason: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'REJECT_PAYMENT',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: { orderId, reason },
          },
        });
        await this.notifications.notifyUsers(tx, [payment.order.memberId], {
          type: 'PAYMENT_REJECTED',
          title: 'Yêu cầu thanh toán bị từ chối',
          message: `Đơn ${payment.order.orderNumber}: ${reason}`,
          metadata: { orderId, paymentId: payment.id },
        });
        return rejected;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async requestPaymentConfirmation(
    orderId: string,
    method: PaymentMethod,
    user: AuthUser,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        await tx.payment.updateMany({
          where: {
            orderId,
            status: PaymentStatus.AWAITING_CONFIRMATION,
            expiresAt: { lte: now },
          },
          data: { status: PaymentStatus.EXPIRED },
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
        });
        if (order.status !== OrderStatus.PENDING)
          throw new ApiError(
            'ORDER_NOT_PAYABLE',
            'Đơn hàng không còn ở trạng thái chờ thanh toán.',
            HttpStatus.CONFLICT,
          );
        const awaiting = await tx.payment.findFirst({
          where: {
            orderId,
            status: PaymentStatus.AWAITING_CONFIRMATION,
          },
        });
        if (awaiting)
          throw new ApiError(
            'PAYMENT_ALREADY_AWAITING',
            'Đơn hàng đã có yêu cầu thanh toán đang chờ nhân viên xác nhận.',
            HttpStatus.CONFLICT,
          );
        const payment = await tx.payment.create({
          data: {
            orderId,
            transactionCode: this.createTransactionCode(),
            amount: order.totalAmount,
            method,
            status: PaymentStatus.AWAITING_CONFIRMATION,
            requestedAt: now,
            expiresAt: new Date(now.getTime() + PAYMENT_CONFIRMATION_TTL_MS),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'SUBMIT_PAYMENT_CONFIRMATION',
            entityType: 'Payment',
            entityId: payment.id,
            metadata: { orderId, method, expiresAt: payment.expiresAt },
          },
        });
        const isCash = method === PaymentMethod.CASH;
        await this.notifications.notifyRoles(
          tx,
          [RoleCode.OWNER, RoleCode.RECEPTIONIST],
          {
            type: 'PAYMENT_REQUESTED',
            title: isCash
              ? 'Tiền mặt chờ xác nhận thu'
              : 'Chuyển khoản chờ xác nhận',
            message: isCash
              ? `Hội viên của đơn ${order.orderNumber} đã xác nhận thanh toán tiền mặt tại quầy.`
              : `Hội viên của đơn ${order.orderNumber} đã xác nhận chuyển khoản.`,
            metadata: { orderId, paymentId: payment.id, method },
          },
        );
        return {
          orderId,
          status: OrderStatus.PENDING,
          payment,
          confirmationRequired: true,
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async activateOrderEntitlements(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, member: { include: { memberProfile: true } } },
    });
    if (order.status !== OrderStatus.PENDING)
      throw new ApiError(
        'ORDER_NOT_PAYABLE',
        'Đơn hàng không còn ở trạng thái chờ thanh toán.',
        HttpStatus.CONFLICT,
      );
    const memberProfile = order.member.memberProfile;
    if (!memberProfile)
      throw new ApiError(
        'MEMBER_PROFILE_REQUIRED',
        'Đơn hàng không có hồ sơ hội viên hợp lệ.',
      );

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
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
    });
  }

  private async writePaymentAudit(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    orderId: string,
    paymentId: string,
    amount: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType: 'Payment',
        entityId: paymentId,
        metadata: { orderId, amount },
      },
    });
  }

  private assertPaymentStaff(user: AuthUser) {
    if (
      !user.roles.includes(RoleCode.OWNER) &&
      !user.roles.includes(RoleCode.RECEPTIONIST)
    )
      throw new ApiError(
        'PAYMENT_STAFF_REQUIRED',
        'Chỉ Chủ phòng hoặc Lễ tân mới có thể xác nhận thanh toán.',
        HttpStatus.FORBIDDEN,
      );
  }

  private async runPaymentTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    operationName: string,
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= PAYMENT_TRANSACTION_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(
          operation,
          PAYMENT_TRANSACTION_OPTIONS,
        );
      } catch (error) {
        if (
          !this.isRetryableTransactionError(error) ||
          attempt === PAYMENT_TRANSACTION_MAX_ATTEMPTS
        )
          throw error;
        console.warn(
          'Retrying payment transaction after transient database error.',
          {
            attempt,
            code: error.code,
            operation: operationName,
          },
        );
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
    throw new Error('Payment transaction retry loop ended unexpectedly.');
  }

  private isRetryableTransactionError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      RETRYABLE_PRISMA_CODES.has(error.code)
    );
  }

  private async findCompletedPaymentResult(orderId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderId,
        status: PaymentStatus.PAID,
        order: { status: OrderStatus.PAID },
      },
      include: { order: true, receipt: true },
    });
    if (!payment?.receipt) return null;
    return {
      orderId,
      status: OrderStatus.PAID,
      payment,
      receipt: payment.receipt,
    };
  }

  private createTransactionCode() {
    return `PAY-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private createReceiptNumber() {
    return `RCT-${Date.now()}-${randomUUID().slice(0, 5).toUpperCase()}`;
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
    if (order.status === OrderStatus.CANCELLED) return order;
    if (order.status !== OrderStatus.PENDING)
      throw new ApiError(
        'ORDER_NOT_CANCELLABLE',
        'Chỉ có thể hủy đơn hàng đang chờ thanh toán.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: {
          orderId,
          status: PaymentStatus.AWAITING_CONFIRMATION,
        },
        data: {
          status: PaymentStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: 'Đơn hàng đã bị hủy.',
        },
      });
      const cancelled = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CANCEL_ORDER',
          entityType: 'Order',
          entityId: orderId,
        },
      });
      return cancelled;
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
          include: {
            receipt: true,
            confirmedBy: {
              select: {
                fullName: true,
                email: true,
                roles: { select: { role: { select: { code: true } } } },
              },
            },
          },
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
    if (!payment.paidAt || !payment.confirmedAt)
      throw new ApiError(
        'RECEIPT_CONFIRMATION_MISSING',
        'Giao dịch chưa có đầy đủ thông tin xác nhận để xuất phiếu thu.',
      );
    return { order, payment, receipt: payment.receipt };
  }

  async streamReceipt(orderId: string, user: AuthUser, response: Response) {
    const data = await this.receipt(orderId, user);
    const payment = data.payment;
    if (!payment.paidAt || !payment.confirmedAt)
      throw new ApiError(
        'RECEIPT_CONFIRMATION_MISSING',
        'Giao dịch chưa có đầy đủ thông tin xác nhận để xuất phiếu thu.',
      );
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
    doc.text(`Ngày thu: ${formatAppDateTime(payment.paidAt)}`);
    doc.text(
      `Phương thức: ${payment.method === PaymentMethod.CASH ? 'Tiền mặt' : 'Chuyển khoản'}`,
    );
    if (payment.confirmedBy) {
      const confirmerRole = payment.confirmedBy.roles.some(
        (item) => item.role.code === RoleCode.OWNER,
      )
        ? 'Chủ phòng'
        : 'Lễ tân';
      doc.text(
        `Người xác nhận: ${payment.confirmedBy.fullName} (${confirmerRole})`,
      );
      doc.text(`Tài khoản xác nhận: ${payment.confirmedBy.email}`);
    } else {
      doc.text('Người xác nhận: Không ghi nhận (giao dịch dữ liệu cũ)');
      doc.text('Tài khoản xác nhận: Không có dữ liệu');
    }
    doc.text(`Thời gian xác nhận: ${formatAppDateTime(payment.confirmedAt)}`);
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
