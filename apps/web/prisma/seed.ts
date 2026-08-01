/**
 * Ecowoods — Prisma Seed Script
 *
 * Populates the database with realistic demo data for development.
 * 씨드 데이터: 개발 환경용 현실적인 데모 데이터
 *
 * Usage:
 *   pnpm --filter @ecowoods/web exec prisma db seed
 *
 * Or via npm script (package.json):
 *   "prisma": { "seed": "ts-node --transpile-only prisma/seed.ts" }
 */

import { PrismaClient, UserRole, QuoteStatus, ProjectStatus, InvoiceStatus, InvoiceStage, PaymentMethod, PaymentStatus, InquiryStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Ecowoods database...\n');

  // ── Wipe in dependency order ─────────────────────────────────────────
  await db.payment.deleteMany();
  await db.invoice.deleteMany();
  await db.projectNote.deleteMany();
  await db.inquiryReply.deleteMany();
  await db.inquiry.deleteMany();
  await db.project.deleteMany();
  await db.quoteRequest.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
  await db.settings.deleteMany();
  console.log('  ✓ Cleared existing data');

  // ── Global Settings ───────────────────────────────────────────────────
  await db.settings.create({
    data: {
      defaultDepositPct: 30,
      defaultMidpointPct: 40,
      defaultFinalPct: 30,
      defaultTaxRate: 13,  // Ontario HST
      companyName: 'Ecowoods Hardwood Flooring Inc.',
      companyAddress: '32 Norfield Crescent, Toronto, ON M9W 1X6',
      companyPhone: '(416) 249-1276',
      companyEmail: 'services@ecowoods.ca',
      companyNumberHst: 'RT 1234 5678',
      aiEnabled: false,
    },
  });
  console.log('  ✓ Settings created');

  // ── Users ─────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin2026!', 12);
  const customerPasswordHash = await bcrypt.hash('Customer2026!', 12);

  const admin = await db.user.create({
    data: {
      email: 'admin@ecowoods.ca',
      name: 'Mike Kowalski',
      phone: '(416) 249-1276',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      emailVerified: true,
    },
  });

  const sarah = await db.user.create({
    data: {
      email: 'sarah.miller@gmail.com',
      name: 'Sarah Miller',
      phone: '(416) 555-0100',
      passwordHash: customerPasswordHash,
      role: UserRole.USER,
      emailVerified: true,
    },
  });

  const david = await db.user.create({
    data: {
      email: 'david.kim@outlook.com',
      name: 'David Kim',
      phone: '(647) 555-0201',
      passwordHash: customerPasswordHash,
      role: UserRole.USER,
      emailVerified: true,
    },
  });

  const priya = await db.user.create({
    data: {
      email: 'priya.tomas@gmail.com',
      name: 'Priya Tomas',
      phone: '(905) 555-0312',
      passwordHash: customerPasswordHash,
      role: UserRole.USER,
      emailVerified: true,
    },
  });

  console.log('  ✓ Users created (admin + 3 customers)');

  // ── Quote Requests ────────────────────────────────────────────────────
  const quote1 = await db.quoteRequest.create({
    data: {
      name: 'Sarah Miller',
      email: 'sarah.miller@gmail.com',
      phone: '(416) 555-0100',
      city: 'Toronto',
      province: 'ON',
      address: '47 Rosedale Valley Rd, Toronto, ON M4W 1P9',
      species: ['White Oak', 'Red Oak'],
      squareFeet: 1450,
      projectType: 'renovation',
      timeline: '1_month',
      budgetRange: '$15k-$25k',
      service: 'refinishing',
      notes: 'We have 100-year-old red oak floors throughout the main level. Looking for a full refinish with a Scandinavian white stain. Also interested in stair refinishing.',
      status: QuoteStatus.ACCEPTED,
      userId: sarah.id,
    },
  });

  const quote2 = await db.quoteRequest.create({
    data: {
      name: 'David Kim',
      email: 'david.kim@outlook.com',
      phone: '(647) 555-0201',
      city: 'North York',
      province: 'ON',
      address: '120 Yonge Blvd, North York, ON M5M 3G7',
      species: ['Hard Maple', 'White Oak'],
      squareFeet: 2200,
      projectType: 'new_build',
      timeline: '2-3_weeks',
      budgetRange: '$25k-$40k',
      service: 'installation',
      notes: 'New construction home, need wide-plank white oak installed throughout main and second floor. Kitchen in Hard Maple.',
      status: QuoteStatus.ACCEPTED,
      userId: david.id,
    },
  });

  const quote3 = await db.quoteRequest.create({
    data: {
      name: 'Priya Tomas',
      email: 'priya.tomas@gmail.com',
      phone: '(905) 555-0312',
      city: 'Mississauga',
      province: 'ON',
      address: '88 Lakeshore Rd W, Mississauga, ON L5H 1G5',
      species: ['Black Walnut'],
      squareFeet: 800,
      projectType: 'renovation',
      timeline: 'flexible',
      budgetRange: '$10k-$15k',
      service: 'installation',
      notes: 'Custom walnut herringbone pattern for the living and dining room. Want something distinctive.',
      status: QuoteStatus.PENDING,
      userId: priya.id,
    },
  });

  // Unlinked quote (submitted before registration)
  const quote4 = await db.quoteRequest.create({
    data: {
      name: 'Marco Rossi',
      email: 'marco.rossi@rogers.com',
      phone: '(416) 555-0444',
      city: 'Etobicoke',
      province: 'ON',
      address: '234 Prince Edward Dr N, Etobicoke, ON M8Y 3Y5',
      species: ['Red Oak'],
      squareFeet: 950,
      projectType: 'renovation',
      timeline: 'asap',
      budgetRange: '$8k-$12k',
      service: 'refinishing',
      notes: 'Dog scratched the floors badly after another contractor\'s job. Need a full refinish with Bona Traffic.',
      status: QuoteStatus.PENDING,
    },
  });

  console.log('  ✓ Quote requests created');

  // ── Projects ──────────────────────────────────────────────────────────
  const project1 = await db.project.create({
    data: {
      userId: sarah.id,
      title: 'Rosedale Victorian — Full Refinish & Stair Re-cap',
      description: `Complete refinish of 1,450 sq ft of original 100-year-old red oak flooring.
      Services include: full sand-and-refinish, custom Scandinavian white stain, Bona Traffic HD sealant (3 coats), and stair refinishing (14 treads + risers).
      Dust-free HEPA sanding throughout. Walk-on ready within 24 hours.`,
      address: '47 Rosedale Valley Rd',
      city: 'Toronto',
      province: 'ON',
      species: ['Red Oak'],
      squareFeet: 1450,
      startDate: new Date('2026-06-15'),
      endDate: new Date('2026-06-22'),
      status: ProjectStatus.IN_PROGRESS,
      contractPdfUrl: null,
      depositPct: 30,
      midpointPct: 40,
      finalPct: 30,
      taxRate: 13,
      contractValue: 18500,
    },
  });

  // Link quote1 to project1
  await db.quoteRequest.update({
    where: { id: quote1.id },
    data: { projectId: project1.id },
  });

  const project2 = await db.project.create({
    data: {
      userId: david.id,
      title: 'North York New Build — Wide Plank White Oak + Hard Maple Kitchen',
      description: `Installation of 6" wide-plank engineered white oak (ABCD grade) throughout main and second floor (1,800 sq ft).
      Hard maple solid for kitchen and breakfast nook (400 sq ft).
      Custom stair nosings. Site-finished with Loba 2K Supra.`,
      address: '120 Yonge Blvd',
      city: 'North York',
      province: 'ON',
      species: ['White Oak', 'Hard Maple'],
      squareFeet: 2200,
      startDate: new Date('2026-07-07'),
      endDate: new Date('2026-07-18'),
      status: ProjectStatus.CONTRACT_SENT,
      depositPct: 35,
      midpointPct: 35,
      finalPct: 30,
      taxRate: 13,
      contractValue: 34200,
    },
  });

  await db.quoteRequest.update({
    where: { id: quote2.id },
    data: { projectId: project2.id },
  });

  // A completed project for payment history demo
  const project3 = await db.project.create({
    data: {
      userId: sarah.id,
      title: 'Rosedale — Foyer Custom Walnut Inlay (2025)',
      description: 'Custom hand-cut walnut medallion inlay in the foyer entrance, 8x8 ft pattern. Previously completed.',
      address: '47 Rosedale Valley Rd',
      city: 'Toronto',
      province: 'ON',
      species: ['Black Walnut'],
      squareFeet: 64,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-10-05'),
      status: ProjectStatus.COMPLETED,
      contractValue: 4800,
      taxRate: 13,
      depositPct: 50,
      midpointPct: 0,
      finalPct: 50,
    },
  });

  await db.projectNote.createMany({
    data: [
      {
        projectId: project1.id,
        content: 'Customer wants a matte finish, not glossy. Reference: Bona Traffic HD in "Neutral" tone.',
      },
      {
        projectId: project1.id,
        content: 'Dog present — crew must ensure gate is closed at all times. Customer will work from home during installation.',
      },
      {
        projectId: project2.id,
        content: 'Builder requires WSIB certificate before site entry. Sent by email 2026-06-01.',
      },
    ],
  });

  console.log('  ✓ Projects created (3)');

  // ── Invoices ──────────────────────────────────────────────────────────

  // Project 1 (IN_PROGRESS) — Deposit paid, midpoint issued
  const inv1Subtotal = Number(project1.contractValue!) * (Number(project1.depositPct!) / 100);
  const inv1Tax = inv1Subtotal * (Number(project1.taxRate!) / 100);
  const inv1 = await db.invoice.create({
    data: {
      number: 'INV-2026-001',
      projectId: project1.id,
      stage: InvoiceStage.DEPOSIT,
      status: InvoiceStatus.PAID,
      subtotal: inv1Subtotal,          // 5550
      discountPct: 0,
      surchargePct: 0,
      taxRate: project1.taxRate!,
      total: inv1Subtotal + inv1Tax,   // 6271.50
      description: 'Deposit — 30% of contract value. Secures your installation date and covers material ordering.',
      lineItems: JSON.stringify([
        { description: 'Deposit (30% of contract value)', qty: 1, unitPrice: inv1Subtotal, amount: inv1Subtotal },
        { description: 'Ontario HST (13%)', qty: 1, unitPrice: inv1Tax, amount: inv1Tax },
      ]),
      dueDate: new Date('2026-06-10'),
      issuedAt: new Date('2026-06-01'),
      paidAt: new Date('2026-06-08'),
    },
  });

  const inv2Subtotal = Number(project1.contractValue!) * (Number(project1.midpointPct!) / 100);
  const inv2Tax = inv2Subtotal * (Number(project1.taxRate!) / 100);
  const inv2 = await db.invoice.create({
    data: {
      number: 'INV-2026-002',
      projectId: project1.id,
      stage: InvoiceStage.MIDPOINT,
      status: InvoiceStatus.SENT,
      subtotal: inv2Subtotal,
      discountPct: 0,
      surchargePct: 0,
      taxRate: project1.taxRate!,
      total: inv2Subtotal + inv2Tax,
      description: 'Progress payment — 40% of contract value. Due on day 3 of installation.',
      lineItems: JSON.stringify([
        { description: 'Midpoint payment (40% of contract value)', qty: 1, unitPrice: inv2Subtotal, amount: inv2Subtotal },
        { description: 'Ontario HST (13%)', qty: 1, unitPrice: inv2Tax, amount: inv2Tax },
      ]),
      dueDate: new Date('2026-06-17'),
      issuedAt: new Date('2026-06-15'),
    },
  });

  // Project 2 (CONTRACT_SENT) — Deposit draft
  const inv3Subtotal = Number(project2.contractValue!) * (Number(project2.depositPct!) / 100);
  const inv3Tax = inv3Subtotal * (Number(project2.taxRate!) / 100);
  await db.invoice.create({
    data: {
      number: 'INV-2026-003',
      projectId: project2.id,
      stage: InvoiceStage.DEPOSIT,
      status: InvoiceStatus.DRAFT,
      subtotal: inv3Subtotal,
      discountPct: 5,   // 5% early signing discount
      surchargePct: 0,
      taxRate: project2.taxRate!,
      total: (inv3Subtotal * 0.95) + (inv3Subtotal * 0.95 * Number(project2.taxRate!) / 100),
      description: 'Deposit — 35% of contract. Includes 5% early signing discount.',
      lineItems: JSON.stringify([
        { description: 'Deposit (35% of contract value)', qty: 1, unitPrice: inv3Subtotal, amount: inv3Subtotal },
        { description: 'Early signing discount (5%)', qty: 1, unitPrice: -(inv3Subtotal * 0.05), amount: -(inv3Subtotal * 0.05) },
        { description: 'Ontario HST (13%)', qty: 1, unitPrice: inv3Subtotal * 0.95 * 0.13, amount: inv3Subtotal * 0.95 * 0.13 },
      ]),
      dueDate: new Date('2026-07-05'),
    },
  });

  // Project 3 (COMPLETED) — Both invoices paid
  const inv4Subtotal = Number(project3.contractValue!) * 0.50;
  const inv4Tax = inv4Subtotal * 0.13;
  const inv4 = await db.invoice.create({
    data: {
      number: 'INV-2025-021',
      projectId: project3.id,
      stage: InvoiceStage.DEPOSIT,
      status: InvoiceStatus.PAID,
      subtotal: inv4Subtotal,
      taxRate: 13,
      total: inv4Subtotal + inv4Tax,
      description: 'Deposit — 50% of contract value.',
      lineItems: JSON.stringify([
        { description: 'Deposit (50% of contract value)', qty: 1, unitPrice: inv4Subtotal, amount: inv4Subtotal },
        { description: 'Ontario HST (13%)', qty: 1, unitPrice: inv4Tax, amount: inv4Tax },
      ]),
      dueDate: new Date('2025-09-28'),
      issuedAt: new Date('2025-09-25'),
      paidAt: new Date('2025-09-27'),
    },
  });

  const inv5Subtotal = Number(project3.contractValue!) * 0.50;
  const inv5Tax = inv5Subtotal * 0.13;
  const inv5 = await db.invoice.create({
    data: {
      number: 'INV-2025-022',
      projectId: project3.id,
      stage: InvoiceStage.FINAL,
      status: InvoiceStatus.PAID,
      subtotal: inv5Subtotal,
      taxRate: 13,
      total: inv5Subtotal + inv5Tax,
      description: 'Final payment — balance on completion.',
      lineItems: JSON.stringify([
        { description: 'Final balance (50% of contract value)', qty: 1, unitPrice: inv5Subtotal, amount: inv5Subtotal },
        { description: 'Ontario HST (13%)', qty: 1, unitPrice: inv5Tax, amount: inv5Tax },
      ]),
      dueDate: new Date('2025-10-07'),
      issuedAt: new Date('2025-10-05'),
      paidAt: new Date('2025-10-06'),
    },
  });

  console.log('  ✓ Invoices created (5)');

  // ── Payments ──────────────────────────────────────────────────────────
  await db.payment.createMany({
    data: [
      {
        invoiceId: inv1.id,
        userId: sarah.id,
        amount: inv1.total,
        method: PaymentMethod.STRIPE,
        status: PaymentStatus.COMPLETED,
        stripePaymentIntentId: 'pi_3Abc123_test',
        stripeCharged: true,
      },
      {
        invoiceId: inv4.id,
        userId: sarah.id,
        amount: inv4.total,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.COMPLETED,
        bankReference: 'EW-2025-021',
        bankConfirmedAt: new Date('2025-09-28'),
        bankConfirmedByNote: 'E-transfer received $2,712.00. Matches INV-2025-021.',
      },
      {
        invoiceId: inv5.id,
        userId: sarah.id,
        amount: inv5.total,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.COMPLETED,
        bankReference: 'EW-2025-022',
        bankConfirmedAt: new Date('2025-10-07'),
        bankConfirmedByNote: 'E-transfer received $2,712.00. Matches INV-2025-022.',
      },
    ],
  });

  console.log('  ✓ Payments created');

  // ── Inquiries ─────────────────────────────────────────────────────────
  const inq1 = await db.inquiry.create({
    data: {
      userId: priya.id,
      name: 'Priya Tomas',
      email: 'priya.tomas@gmail.com',
      phone: '(905) 555-0312',
      subject: 'Herringbone feasibility for condo over concrete',
      message: 'Hi, I live in a condo with a concrete subfloor (on a higher floor). Is herringbone hardwood possible? What would the process look like and are there special adhesives required?',
      status: InquiryStatus.IN_PROGRESS,
    },
  });

  await db.inquiryReply.createMany({
    data: [
      {
        inquiryId: inq1.id,
        fromAdmin: true,
        content: `Hi Priya,

Great question! Herringbone on concrete is absolutely doable — we do it regularly in Toronto condos.

The key is the right adhesive (we use Bona R850, which provides both excellent bond and some acoustic deadening) and making sure the concrete is flat to within 3/16" over 10 ft. We do a moisture test and flatness check at no charge during our consultation.

For a floating installation option: some of our engineered products can go over concrete without adhesive, which many condo boards prefer for reversibility.

Happy to come by for a free assessment — would next week work for you?

Best,
Mike @ Ecowoods`,
      },
      {
        inquiryId: inq1.id,
        fromAdmin: false,
        content: 'Thanks Mike, that is really helpful! Next Wednesday afternoon works if you have availability.',
      },
    ],
  });

  const inq2 = await db.inquiry.create({
    data: {
      name: 'Andrew Burke',
      email: 'andrew.burke@hotmail.com',
      phone: '(416) 555-0567',
      subject: 'Reclaimed barn wood — do you source it?',
      message: 'We\'re renovating a 1920s farmhouse in King City and want reclaimed barn board for the main floor. Do you source and install reclaimed wood? Approximately 1,800 sq ft.',
      status: InquiryStatus.NEW,
    },
  });

  console.log('  ✓ Inquiries created (2)');

  // ── Summary ───────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('  Admin login:');
  console.log('    Email: admin@ecowoods.ca');
  console.log('    Password: Admin2026!');
  console.log('');
  console.log('  Customer logins:');
  console.log('    Email: sarah.miller@gmail.com / Customer2026!');
  console.log('    Email: david.kim@outlook.com  / Customer2026!');
  console.log('    Email: priya.tomas@gmail.com  / Customer2026!');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
