import {
  MembershipType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductType,
  RoleCode,
  UserStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const DAY = 86_400_000;

type SeedUser = {
  email: string;
  fullName: string;
  phone: string;
  roleCode: RoleCode;
  memberCode?: string;
  trainerCode?: string;
  specialties?: string;
  yearsExperience?: number;
};

async function migrateSeedEmail(oldEmail: string, newEmail: string) {
  const [oldUser, newUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: oldEmail } }),
    prisma.user.findUnique({ where: { email: newEmail } }),
  ]);
  if (oldUser && !newUser) {
    await prisma.user.update({
      where: { id: oldUser.id },
      data: { email: newEmail },
    });
  }
}

async function upsertUser(input: SeedUser, passwordHash: string) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: input.roleCode },
  });
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      fullName: input.fullName,
      phone: input.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  if (input.memberCode) {
    await prisma.memberProfile.upsert({
      where: { userId: user.id },
      update: { memberCode: input.memberCode },
      create: { userId: user.id, memberCode: input.memberCode },
    });
  }
  if (input.trainerCode) {
    await prisma.trainerProfile.upsert({
      where: { userId: user.id },
      update: {
        trainerCode: input.trainerCode,
        specialties: input.specialties,
        yearsExperience: input.yearsExperience ?? 0,
      },
      create: {
        userId: user.id,
        trainerCode: input.trainerCode,
        specialties: input.specialties,
        yearsExperience: input.yearsExperience ?? 0,
      },
    });
  }
  return user;
}

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword)
    throw new Error(
      'Thiếu SEED_PASSWORD. Hãy cấu hình trong backend/.env trước khi seed.',
    );
  const passwordHash = await hash(seedPassword, 12);

  await Promise.all(
    [
      [RoleCode.OWNER, 'Chủ phòng'],
      [RoleCode.RECEPTIONIST, 'Lễ tân'],
      [RoleCode.TRAINER, 'Huấn luyện viên'],
      [RoleCode.MEMBER, 'Hội viên'],
    ].map(([code, name]) =>
      prisma.role.upsert({
        where: { code },
        update: { name },
        create: { code, name },
      }),
    ),
  );

  await migrateSeedEmail('letan.demo@gym.local', 'letan@gym.local');
  await migrateSeedEmail('trainer.demo@gym.local', 'minhanh.pt@gym.local');
  await migrateSeedEmail('member.demo@gym.local', 'khanhbang@gym.local');

  const owner = await upsertUser(
    {
      email: (
        process.env.OWNER_EMAIL || 'vhoanglong54@gmail.com'
      ).toLowerCase(),
      fullName: 'Chủ phòng Gym',
      phone: '0901000001',
      roleCode: RoleCode.OWNER,
    },
    passwordHash,
  );
  await upsertUser(
    {
      email: 'letan@gym.local',
      fullName: 'Nguyễn Mai Lan',
      phone: '0902000001',
      roleCode: RoleCode.RECEPTIONIST,
    },
    passwordHash,
  );

  const minhAnh = await upsertUser(
    {
      email: 'minhanh.pt@gym.local',
      fullName: 'PT Minh Anh',
      phone: '0903000001',
      roleCode: RoleCode.TRAINER,
      trainerCode: 'PT-000101',
      specialties: 'Sức mạnh, thể hình, giảm mỡ',
      yearsExperience: 5,
    },
    passwordHash,
  );
  const quangHuy = await upsertUser(
    {
      email: 'quanghuy.pt@gym.local',
      fullName: 'PT Quang Huy',
      phone: '0903000002',
      roleCode: RoleCode.TRAINER,
      trainerCode: 'PT-000102',
      specialties: 'Tăng cơ, phục hồi vận động',
      yearsExperience: 4,
    },
    passwordHash,
  );
  const thaoVy = await upsertUser(
    {
      email: 'thaovy.pt@gym.local',
      fullName: 'PT Thảo Vy',
      phone: '0903000003',
      roleCode: RoleCode.TRAINER,
      trainerCode: 'PT-000103',
      specialties: 'Giảm mỡ, mobility, functional training',
      yearsExperience: 6,
    },
    passwordHash,
  );

  const khanhBang = await upsertUser(
    {
      email: 'khanhbang@gym.local',
      fullName: 'Khánh Băng',
      phone: '0904000001',
      roleCode: RoleCode.MEMBER,
      memberCode: 'MB-000101',
    },
    passwordHash,
  );
  const thuHa = await upsertUser(
    {
      email: 'thuha@gym.local',
      fullName: 'Thu Hà',
      phone: '0904000002',
      roleCode: RoleCode.MEMBER,
      memberCode: 'MB-000102',
    },
    passwordHash,
  );
  const giaLinh = await upsertUser(
    {
      email: 'gialinh@gym.local',
      fullName: 'Gia Linh',
      phone: '0904000003',
      roleCode: RoleCode.MEMBER,
      memberCode: 'MB-000103',
    },
    passwordHash,
  );
  const hoangNam = await upsertUser(
    {
      email: 'hoangnam@gym.local',
      fullName: 'Hoàng Nam',
      phone: '0904000004',
      roleCode: RoleCode.MEMBER,
      memberCode: 'MB-000104',
    },
    passwordHash,
  );

  const membershipPlans = [
    {
      id: '00000000-0000-4000-8000-000000000101',
      name: 'Gym 1 Tháng',
      description: 'Tập không giới hạn trong 30 ngày liên tục',
      type: MembershipType.DURATION,
      durationDays: 30,
      visitLimit: null,
      price: 690000,
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      name: 'Gym 2 Tháng',
      description: 'Tập không giới hạn trong 60 ngày liên tục',
      type: MembershipType.DURATION,
      durationDays: 60,
      visitLimit: null,
      price: 1250000,
    },
    {
      id: '00000000-0000-4000-8000-000000000103',
      name: 'Gym 3 Tháng',
      description: 'Tập không giới hạn trong 90 ngày liên tục',
      type: MembershipType.DURATION,
      durationDays: 90,
      visitLimit: null,
      price: 1790000,
    },
  ];
  for (const plan of membershipPlans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: { ...plan, isActive: true },
      create: { ...plan, isActive: true },
    });
  }

  const ptPackages = [
    {
      id: '00000000-0000-4000-8000-000000000201',
      name: 'PT 8 Buổi',
      description: '8 buổi tập cá nhân để xây nền tảng',
      sessionCount: 8,
      price: 2400000,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      name: 'PT 12 Buổi',
      description: '12 buổi theo sát mục tiêu và tiến độ',
      sessionCount: 12,
      price: 3360000,
    },
    {
      id: '00000000-0000-4000-8000-000000000203',
      name: 'PT 24 Buổi',
      description: '24 buổi huấn luyện chuyên sâu dài hạn',
      sessionCount: 24,
      price: 6240000,
    },
  ];
  for (const pkg of ptPackages) {
    await prisma.ptPackage.upsert({
      where: { id: pkg.id },
      update: { ...pkg, isActive: true },
      create: { ...pkg, isActive: true },
    });
  }

  const now = new Date();
  const orderSeeds = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      itemId: '11000000-0000-4000-8000-000000000001',
      orderNumber: 'ORD-SEED-0001',
      memberId: thuHa.id,
      status: OrderStatus.PENDING,
      productType: ProductType.MEMBERSHIP,
      productId: membershipPlans[0].id,
      productName: membershipPlans[0].name,
      productDescription: membershipPlans[0].description,
      amount: membershipPlans[0].price,
      createdAt: new Date(now.getTime() - DAY),
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      itemId: '11000000-0000-4000-8000-000000000002',
      orderNumber: 'ORD-SEED-0002',
      memberId: khanhBang.id,
      status: OrderStatus.PAID,
      productType: ProductType.MEMBERSHIP,
      productId: membershipPlans[2].id,
      productName: membershipPlans[2].name,
      productDescription: membershipPlans[2].description,
      amount: membershipPlans[2].price,
      createdAt: new Date(now.getTime() - 4 * DAY),
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      itemId: '11000000-0000-4000-8000-000000000003',
      orderNumber: 'ORD-SEED-0003',
      memberId: giaLinh.id,
      status: OrderStatus.CANCELLED,
      productType: ProductType.PT_PACKAGE,
      productId: ptPackages[0].id,
      productName: ptPackages[0].name,
      productDescription: ptPackages[0].description,
      amount: ptPackages[0].price,
      createdAt: new Date(now.getTime() - 3 * DAY),
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      itemId: '11000000-0000-4000-8000-000000000004',
      orderNumber: 'ORD-SEED-0004',
      memberId: hoangNam.id,
      status: OrderStatus.PAID,
      productType: ProductType.PT_PACKAGE,
      productId: ptPackages[1].id,
      productName: ptPackages[1].name,
      productDescription: ptPackages[1].description,
      amount: ptPackages[1].price,
      createdAt: new Date(now.getTime() - 2 * DAY),
    },
  ];

  for (const order of orderSeeds) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {
        orderNumber: order.orderNumber,
        memberId: order.memberId,
        ...(order.status === OrderStatus.PENDING
          ? {}
          : { status: order.status }),
        totalAmount: order.amount,
        createdAt: order.createdAt,
      },
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        memberId: order.memberId,
        status: order.status,
        totalAmount: order.amount,
        createdAt: order.createdAt,
      },
    });
    await prisma.orderItem.upsert({
      where: { id: order.itemId },
      update: {
        orderId: order.id,
        productType: order.productType,
        productId: order.productId,
        productName: order.productName,
        productDescription: order.productDescription,
        unitPrice: order.amount,
      },
      create: {
        id: order.itemId,
        orderId: order.id,
        productType: order.productType,
        productId: order.productId,
        productName: order.productName,
        productDescription: order.productDescription,
        unitPrice: order.amount,
      },
    });
  }

  const khanhBangProfile = await prisma.memberProfile.findUniqueOrThrow({
    where: { userId: khanhBang.id },
  });
  const hoangNamProfile = await prisma.memberProfile.findUniqueOrThrow({
    where: { userId: hoangNam.id },
  });
  const paidSeeds = [
    {
      order: orderSeeds[1],
      paymentId: '12000000-0000-4000-8000-000000000002',
      transactionCode: 'PAY-SEED-0002',
      receiptId: '13000000-0000-4000-8000-000000000002',
      receiptNumber: 'RCT-SEED-0002',
      paidAt: new Date(now.getTime() - 4 * DAY),
    },
    {
      order: orderSeeds[3],
      paymentId: '12000000-0000-4000-8000-000000000004',
      transactionCode: 'PAY-SEED-0004',
      receiptId: '13000000-0000-4000-8000-000000000004',
      receiptNumber: 'RCT-SEED-0004',
      paidAt: new Date(now.getTime() - 2 * DAY),
    },
  ];
  for (const paid of paidSeeds) {
    await prisma.payment.upsert({
      where: { id: paid.paymentId },
      update: {
        orderId: paid.order.id,
        amount: paid.order.amount,
        method: PaymentMethod.CASH,
        status: PaymentStatus.PAID,
        confirmedById: owner.id,
        requestedAt: paid.paidAt,
        paidAt: paid.paidAt,
        confirmedAt: paid.paidAt,
      },
      create: {
        id: paid.paymentId,
        orderId: paid.order.id,
        transactionCode: paid.transactionCode,
        amount: paid.order.amount,
        method: PaymentMethod.CASH,
        status: PaymentStatus.PAID,
        confirmedById: owner.id,
        requestedAt: paid.paidAt,
        paidAt: paid.paidAt,
        confirmedAt: paid.paidAt,
      },
    });
    await prisma.receipt.upsert({
      where: { paymentId: paid.paymentId },
      update: { receiptNumber: paid.receiptNumber, issuedAt: paid.paidAt },
      create: {
        id: paid.receiptId,
        paymentId: paid.paymentId,
        receiptNumber: paid.receiptNumber,
        issuedAt: paid.paidAt,
      },
    });
  }

  await prisma.memberMembership.upsert({
    where: { orderItemId: orderSeeds[1].itemId },
    update: {
      memberId: khanhBangProfile.id,
      planId: membershipPlans[2].id,
      startDate: paidSeeds[0].paidAt,
      endDate: new Date(paidSeeds[0].paidAt.getTime() + 90 * DAY),
    },
    create: {
      id: '14000000-0000-4000-8000-000000000002',
      memberId: khanhBangProfile.id,
      planId: membershipPlans[2].id,
      orderItemId: orderSeeds[1].itemId,
      startDate: paidSeeds[0].paidAt,
      endDate: new Date(paidSeeds[0].paidAt.getTime() + 90 * DAY),
    },
  });
  await prisma.memberPtPackage.upsert({
    where: { orderItemId: orderSeeds[3].itemId },
    update: {
      memberId: hoangNamProfile.id,
      packageId: ptPackages[1].id,
      sessionsTotal: ptPackages[1].sessionCount,
      expiresAt: new Date(now.getTime() + 365 * DAY),
    },
    create: {
      id: '15000000-0000-4000-8000-000000000004',
      memberId: hoangNamProfile.id,
      packageId: ptPackages[1].id,
      orderItemId: orderSeeds[3].itemId,
      sessionsTotal: ptPackages[1].sessionCount,
      expiresAt: new Date(now.getTime() + 365 * DAY),
    },
  });

  const trainerProfiles = await Promise.all(
    [minhAnh, quangHuy, thaoVy].map((trainer) =>
      prisma.trainerProfile.findUniqueOrThrow({
        where: { userId: trainer.id },
      }),
    ),
  );
  const slotHours = [
    [1, 9],
    [1, 17],
    [2, 10],
    [2, 18],
    [3, 8],
    [3, 16],
  ];
  for (let index = 0; index < slotHours.length; index += 1) {
    const [dayOffset, hour] = slotHours[index];
    const startsAt = new Date(now);
    startsAt.setDate(startsAt.getDate() + dayOffset);
    startsAt.setHours(hour, 0, 0, 0);
    await prisma.ptSlot.upsert({
      where: {
        id: `16000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      },
      update: {},
      create: {
        id: `16000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        trainerId: trainerProfiles[index % trainerProfiles.length].id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        isOpen: true,
      },
    });
  }

  console.log(
    'Đã tạo dữ liệu mẫu: 1 chủ phòng, 1 lễ tân, 3 PT, 4 hội viên, 6 gói và 4 giao dịch.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
