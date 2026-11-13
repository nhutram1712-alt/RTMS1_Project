import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean up existing data
  await prisma.chatMessage.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.post.deleteMany();
  await prisma.service.deleteMany();
  await prisma.landlordProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.room.deleteMany();

  // 2. Hash default password
  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  // 3. Seed Rooms
  const roomsData = [
    { id: '101', name: 'Phòng 101', floor: 1, area: 25.0, price: 2500000, status: 'DANG_THUE' as const, tenantName: 'Nguyễn Văn An' },
    { id: '102', name: 'Phòng 102', floor: 1, area: 25.0, price: 2500000, status: 'DANG_THUE' as const, tenantName: 'Trần Thị Bích' },
    { id: '103', name: 'Phòng 103', floor: 1, area: 28.0, price: 2800000, status: 'TRONG' as const },
    { id: '201', name: 'Ph\u00f2ng 201', floor: 2, area: 25.0, price: 2600000, status: 'TRONG' as const },
    { id: '202', name: 'Phòng 202', floor: 2, area: 25.0, price: 2600000, status: 'DA_COC' as const, depositTenantName: 'Phạm Hoàng Nam', depositTenantPhone: '0988123456', depositTenantAmount: 2600000, expectedMoveInDate: new Date('2026-12-01') },
    { id: '203', name: 'Phòng 203', floor: 2, area: 30.0, price: 3000000, status: 'SUA_CHUA' as const, repairContent: 'Sửa đường ống nước & sơn lại tường', repairTargetDate: new Date('2026-11-20'), repairNote: 'Đang chờ thợ vát tường' }
  ];

  for (const r of roomsData) {
    await prisma.room.create({ data: r as any });
  }

  // 4. Seed Landlord User & Profile
  const landlordUser = await prisma.user.create({
    data: {
      id: 'USR_LANDLORD_01',
      username: 'lekimchi',
      passwordHash: defaultPasswordHash,
      role: 'LANDLORD',
      name: 'Lê Kim Chi',
      phone: '0912345678',
      email: 'nguyenan@gmail.com',
      cccd: '001090123456',
      status: 'HOAT_DONG'
    }
  });

  await prisma.landlordProfile.create({
    data: {
      userId: landlordUser.id,
      name: 'Lê Kim Chi',
      phone: '0905 123 456',
      email: 'nguyenan@gmail.com',
      address: '123 Nguyễn Văn Linh, Đà Nẵng',
      cccd: '048123456789',
      bankName: 'MBBank (Ngân hàng Quân Đội)',
      bankAccount: '0905123456',
      bankOwner: 'LE KIM CHI',
      qrImgUrl: 'https://img.vietqr.io/image/MB-0905123456-compact2.png?accountName=LE%20KIM%20CHI',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'
    }
  });

  // 5. Seed Tenants
  const tenant1 = await prisma.user.create({
    data: {
      id: 'KH001',
      username: 'nguyenvanan',
      passwordHash: defaultPasswordHash,
      role: 'TENANT',
      name: 'Nguyễn Văn An',
      cccd: '048099001234',
      phone: '0905123456',
      email: 'an.nguyen@gmail.com',
      status: 'HOAT_DONG',
      roomId: '101'
    }
  });

  const tenant2 = await prisma.user.create({
    data: {
      id: 'KH002',
      username: 'tranbich',
      passwordHash: defaultPasswordHash,
      role: 'TENANT',
      name: 'Trần Thị Bích',
      cccd: '048099005555',
      phone: '0911222333',
      email: 'bich.tran@gmail.com',
      status: 'HOAT_DONG',
      roomId: '102'
    }
  });

  // 6. Seed Services
  const services = [
    { id: 'SV01', name: 'Tiền Điện', price: 3500, unit: 'kWh', type: 'BAT_BUOC' as const },
    { id: 'SV02', name: 'Tiền Nước', price: 80000, unit: 'Người/tháng', type: 'BAT_BUOC' as const },
    { id: 'SV03', name: 'Rác Thải & Vệ Sinh', price: 30000, unit: 'Phòng/tháng', type: 'BAT_BUOC' as const },
    { id: 'SV04', name: 'Internet Wifi Tốc Độ Cao', price: 100000, unit: 'Phòng/tháng', type: 'TUY_CHON' as const }
  ];

  for (const s of services) {
    await prisma.service.create({ data: s });
  }

  // 7. Seed Contracts
  await prisma.contract.create({
    data: {
      id: 'HDT-101',
      roomId: '101',
      roomPrice: 2500000,
      landlordName: 'Lê Kim Chi',
      landlordPhone: '0912345678',
      landlordCccd: '001090123456',
      landlordAddress: 'Số 12, Đường Lê Lợi, TP. Đà Nẵng',
      tenantName: 'Nguyễn Văn An',
      tenantPhone: '0905123456',
      tenantCccd: '048099001234',
      tenantEmail: 'an.nguyen@gmail.com',
      startDate: new Date('2026-01-15'),
      duration: 12,
      deposit: 2500000,
      status: 'HIEU_LUC',
      services: ['SV01', 'SV02', 'SV03', 'SV04'],
      customPrices: { SV01: 3500, SV02: 80000, SV03: 30000, SV04: 100000 },
      elecOld: 120
    }
  });

  await prisma.contract.create({
    data: {
      id: 'HDT-102',
      roomId: '102',
      roomPrice: 2500000,
      landlordName: 'Lê Kim Chi',
      landlordPhone: '0912345678',
      landlordCccd: '001090123456',
      landlordAddress: 'Số 12, Đường Lê Lợi, TP. Đà Nẵng',
      tenantName: 'Trần Thị Bích',
      tenantPhone: '0911222333',
      tenantCccd: '048099005555',
      tenantEmail: 'bich.tran@gmail.com',
      startDate: new Date('2026-03-01'),
      duration: 12,
      deposit: 2500000,
      status: 'HIEU_LUC',
      services: ['SV01', 'SV02', 'SV03'],
      customPrices: { SV01: 3500, SV02: 80000, SV03: 30000 },
      elecOld: 80
    }
  });

  // 8. Seed Invoices
  await prisma.invoice.create({
    data: {
      id: 'HD0001',
      roomId: '101',
      period: '10/2026',
      date: new Date('2026-10-30'),
      dueDate: new Date('2026-11-05'),
      total: 2880000,
      status: 'DA_THANH_TOAN',
      elecOld: 120,
      elecNew: 170
    }
  });

  await prisma.invoice.create({
    data: {
      id: 'HD0002',
      roomId: '102',
      period: '10/2026',
      date: new Date('2026-11-01'),
      dueDate: new Date('2026-11-05'),
      total: 2790000,
      status: 'CHUA_THANH_TOAN',
      elecOld: 80,
      elecNew: 130
    }
  });

  // 9. Seed Payments
  await prisma.payment.create({
    data: {
      id: 'GD88102',
      invId: 'HD0001',
      date: new Date('2026-10-31T09:15:00'),
      amount: 2880000,
      method: 'VietQR MBBank',
      refNo: 'FT2630491823',
      status: 'DA_THANH_TOAN'
    }
  });

  // 10. Seed Posts
  await prisma.post.create({
    data: {
      id: 'P01',
      title: 'Thông báo sục rửa bể nước sạch toàn bộ dãy trọ',
      date: new Date('2026-11-01T08:00:00'),
      content: 'Kính gửi cư dân dãy trọ An Bình, vào thứ 7 tuần này ban quản lý sẽ tiến hành sục rửa bể nước ngầm. Vui lòng trữ nước sinh hoạt dự phòng.',
      readByTenants: []
    }
  });

  // 11. Seed Issues
  await prisma.issue.create({
    data: {
      id: 'BH001',
      loaiSuCo: 'Hệ thống Nước',
      moTa: 'Vòi nước bồn rửa mặt bị rò rỉ chảy giọt liên tục.',
      hinhAnhUrl: '',
      ngayTao: new Date('2026-11-02T14:20:00'),
      trangThai: 'CHO_XU_LY',
      maPhong: '101',
      maNguoiDung: tenant1.id
    }
  });

  // 12. Seed Chat Messages
  await prisma.chatMessage.createMany({
    data: [
      { roomId: '101', senderRole: 'landlord', text: 'Chào An, tháng này anh gửi hóa đơn rồi nhé!', time: new Date('2026-11-01T10:00:00'), isRead: true },
      { roomId: '101', senderRole: 'tenant', text: 'Dạ em cảm ơn anh, em xem hóa đơn liền ạ!', time: new Date('2026-11-01T10:05:00'), isRead: false },
      { roomId: '102', senderRole: 'tenant', text: 'Cho em hỏi lịch đóng tiền tháng này với ạ', time: new Date('2026-11-02T09:15:00'), isRead: false }
    ]
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

