/* Idempotent seed: safe to run repeatedly. Usage: npm run seed */
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type Svc = { en: string; hi: string; price: number; mins?: number };
type Cat = { slug: string; en: string; hi: string; subs: { slug: string; en: string; hi: string; services: Svc[] }[] };

const CATALOG: Cat[] = [
  { slug: 'electrician', en: 'Electrician', hi: 'इलेक्ट्रीशियन', subs: [
    { slug: 'electrician-wiring', en: 'Wiring & Switches', hi: 'वायरिंग और स्विच', services: [
      { en: 'Switch/Socket Repair', hi: 'स्विच/सॉकेट मरम्मत', price: 149 },
      { en: 'Full House Wiring Check', hi: 'पूरे घर की वायरिंग जांच', price: 499, mins: 120 } ] },
    { slug: 'electrician-fittings', en: 'Fans & Lights', hi: 'पंखे और लाइट', services: [
      { en: 'Ceiling Fan Installation', hi: 'सीलिंग फैन फिटिंग', price: 249 } ] },
  ] },
  { slug: 'plumber', en: 'Plumber', hi: 'प्लंबर', subs: [
    { slug: 'plumber-leaks', en: 'Leakage & Taps', hi: 'लीकेज और नल', services: [
      { en: 'Tap Repair/Replacement', hi: 'नल मरम्मत/बदलाव', price: 179 },
      { en: 'Pipe Leakage Fix', hi: 'पाइप लीकेज ठीक करना', price: 299 } ] },
    { slug: 'plumber-drain', en: 'Drains & Tanks', hi: 'ड्रेन और टंकी', services: [
      { en: 'Drain Unblocking', hi: 'ड्रेन ब्लॉकेज साफ़ करना', price: 399 } ] },
  ] },
  { slug: 'carpenter', en: 'Carpenter', hi: 'बढ़ई', subs: [
    { slug: 'carpenter-furniture', en: 'Furniture Repair', hi: 'फर्नीचर मरम्मत', services: [
      { en: 'Furniture Repair', hi: 'फर्नीचर मरम्मत', price: 299 },
      { en: 'Door/Lock Fitting', hi: 'दरवाज़ा/ताला फिटिंग', price: 349 } ] },
    { slug: 'carpenter-custom', en: 'Custom Work', hi: 'कस्टम काम', services: [
      { en: 'Wardrobe Assembly', hi: 'अलमारी असेंबली', price: 699, mins: 180 } ] },
  ] },
  { slug: 'cleaning', en: 'Home Cleaning', hi: 'होम क्लीनिंग', subs: [
    { slug: 'cleaning-home', en: 'Home Deep Cleaning', hi: 'घर की डीप क्लीनिंग', services: [
      { en: 'Full Home Deep Cleaning', hi: 'पूरे घर की डीप क्लीनिंग', price: 1999, mins: 240 },
      { en: 'Kitchen Cleaning', hi: 'किचन क्लीनिंग', price: 799, mins: 120 } ] },
    { slug: 'cleaning-bathroom', en: 'Bathroom Cleaning', hi: 'बाथरूम क्लीनिंग', services: [
      { en: 'Bathroom Deep Cleaning', hi: 'बाथरूम डीप क्लीनिंग', price: 499 } ] },
  ] },
  { slug: 'ac-repair', en: 'AC Repair', hi: 'एसी रिपेयर', subs: [
    { slug: 'ac-service', en: 'AC Service', hi: 'एसी सर्विस', services: [
      { en: 'AC General Service', hi: 'एसी जनरल सर्विस', price: 499 },
      { en: 'AC Gas Refill', hi: 'एसी गैस रिफिल', price: 1799, mins: 90 } ] },
    { slug: 'ac-install', en: 'Install & Uninstall', hi: 'इंस्टॉल और अनइंस्टॉल', services: [
      { en: 'Split AC Installation', hi: 'स्प्लिट एसी इंस्टॉलेशन', price: 1299, mins: 120 } ] },
  ] },
  { slug: 'painter', en: 'Painter', hi: 'पेंटर', subs: [
    { slug: 'painter-interior', en: 'Interior Painting', hi: 'इंटीरियर पेंटिंग', services: [
      { en: 'Single Room Painting', hi: 'एक कमरे की पेंटिंग', price: 2499, mins: 480 },
      { en: 'Wall Touch-up', hi: 'दीवार टच-अप', price: 599, mins: 120 } ] },
    { slug: 'painter-waterproof', en: 'Waterproofing', hi: 'वॉटरप्रूफिंग', services: [
      { en: 'Terrace Waterproofing', hi: 'छत वॉटरप्रूफिंग', price: 3999, mins: 480 } ] },
  ] },
  { slug: 'appliance-repair', en: 'Appliance Repair', hi: 'उपकरण रिपेयर', subs: [
    { slug: 'appliance-washing', en: 'Washing Machine', hi: 'वॉशिंग मशीन', services: [
      { en: 'Washing Machine Repair', hi: 'वॉशिंग मशीन रिपेयर', price: 349 } ] },
    { slug: 'appliance-fridge', en: 'Refrigerator', hi: 'रेफ्रिजरेटर', services: [
      { en: 'Refrigerator Repair', hi: 'फ्रिज रिपेयर', price: 399 },
      { en: 'Microwave Repair', hi: 'माइक्रोवेव रिपेयर', price: 299 } ] },
  ] },
  { slug: 'beauty', en: 'Beauty & Salon at Home', hi: 'ब्यूटी और सैलून', subs: [
    { slug: 'beauty-women', en: 'Women Salon', hi: 'महिला सैलून', services: [
      { en: 'Facial & Cleanup', hi: 'फेशियल और क्लीनअप', price: 799, mins: 75 },
      { en: 'Hair Spa', hi: 'हेयर स्पा', price: 999, mins: 90 } ] },
    { slug: 'beauty-men', en: 'Men Grooming', hi: 'पुरुष ग्रूमिंग', services: [
      { en: 'Haircut & Beard Trim', hi: 'हेयरकट और दाढ़ी ट्रिम', price: 349, mins: 45 } ] },
  ] },
  { slug: 'tutor', en: 'Home Tutor', hi: 'होम ट्यूटर', subs: [
    { slug: 'tutor-school', en: 'School Subjects', hi: 'स्कूल विषय', services: [
      { en: 'Maths Tuition (1 hr)', hi: 'गणित ट्यूशन (1 घंटा)', price: 399 },
      { en: 'Science Tuition (1 hr)', hi: 'विज्ञान ट्यूशन (1 घंटा)', price: 399 } ] },
    { slug: 'tutor-skills', en: 'Skills', hi: 'कौशल', services: [
      { en: 'Spoken English (1 hr)', hi: 'स्पोकन इंग्लिश (1 घंटा)', price: 449 } ] },
  ] },
  { slug: 'driver', en: 'Driver on Demand', hi: 'ड्राइवर', subs: [
    { slug: 'driver-hourly', en: 'Hourly Driver', hi: 'घंटे के हिसाब से ड्राइवर', services: [
      { en: 'Driver (4 hours)', hi: 'ड्राइवर (4 घंटे)', price: 599, mins: 240 },
      { en: 'Driver (8 hours)', hi: 'ड्राइवर (8 घंटे)', price: 999, mins: 480 } ] },
    { slug: 'driver-outstation', en: 'Outstation', hi: 'आउटस्टेशन', services: [
      { en: 'Outstation Driver (per day)', hi: 'आउटस्टेशन ड्राइवर (प्रति दिन)', price: 1499, mins: 600 } ] },
  ] },
];

const json = (v: unknown) => v as Prisma.InputJsonValue;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

async function seedUser(email: string, name: string, role: 'SUPER_ADMIN' | 'CUSTOMER' | 'PARTNER', password: string, townId?: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  // Do not overwrite an existing password on re-runs.
  return prisma.user.upsert({
    where: { email },
    update: { name, role, townId },
    create: { email, name, role, passwordHash, townId },
  });
}

async function main() {
  // ---- super admin ----
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@townservices.local').toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  await seedUser(adminEmail, 'Super Admin', 'SUPER_ADMIN', adminPass);

  // ---- towns ----
  const nashik = await prisma.town.upsert({
    where: { name_state: { name: 'Nashik', state: 'Maharashtra' } },
    update: {}, create: { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898 },
  });
  const indore = await prisma.town.upsert({
    where: { name_state: { name: 'Indore', state: 'Madhya Pradesh' } },
    update: {}, create: { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  });

  // ---- catalog ----
  const serviceIds: string[] = [];
  for (const [ci, c] of CATALOG.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: { name: json({ en: c.en, hi: c.hi }), sortOrder: ci },
      create: { slug: c.slug, name: json({ en: c.en, hi: c.hi }), sortOrder: ci },
    });
    for (const s of c.subs) {
      const sub = await prisma.serviceSubCategory.upsert({
        where: { slug: s.slug },
        update: { name: json({ en: s.en, hi: s.hi }), categoryId: category.id },
        create: { slug: s.slug, name: json({ en: s.en, hi: s.hi }), categoryId: category.id },
      });
      for (const [si, svc] of s.services.entries()) {
        const id = `seed-${s.slug}-${si + 1}`; // deterministic id => idempotent
        const data = {
          subCategoryId: sub.id,
          name: json({ en: svc.en, hi: svc.hi }),
          basePrice: svc.price,
          durationMin: svc.mins ?? 60,
        };
        await prisma.service.upsert({ where: { id }, update: data, create: { id, ...data } });
        serviceIds.push(id);
      }
    }
  }

  // ---- pricing rules (peak hours) ----
  const rules = [
    { id: 'seed-rule-weekday-evening', name: 'Weekday evening peak', startHour: 18, endHour: 21, weekdays: [1, 2, 3, 4, 5], multiplier: 1.25 },
    { id: 'seed-rule-weekend', name: 'Weekend surge', startHour: null, endHour: null, weekdays: [0, 6], multiplier: 1.2 },
  ];
  for (const r of rules) {
    const { id, ...data } = r;
    await prisma.pricingRule.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // ---- coupons ----
  const validFrom = new Date();
  const validTo = inDays(365);
  const coupons = [
    { code: 'WELCOME100', type: 'FLAT' as const, value: 100, minOrder: 299, perUserLimit: 1, maxDiscount: null },
    { code: 'SAVE10', type: 'PERCENT' as const, value: 10, minOrder: 199, perUserLimit: 5, maxDiscount: 200 },
    { code: 'FESTIVE15', type: 'PERCENT' as const, value: 15, minOrder: 499, perUserLimit: 2, maxDiscount: 400 },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { type: c.type, value: c.value, minOrder: c.minOrder, perUserLimit: c.perUserLimit, maxDiscount: c.maxDiscount },
      create: { ...c, validFrom, validTo },
    });
  }

  // ---- membership plans ----
  const plans = [
    { id: 'seed-plan-silver', name: 'Silver (1 month)', price: 199, durationDays: 30, discountPct: 5, freeSurge: false },
    { id: 'seed-plan-gold', name: 'Gold (3 months)', price: 499, durationDays: 90, discountPct: 8, freeSurge: true },
    { id: 'seed-plan-platinum', name: 'Platinum (1 year)', price: 1499, durationDays: 365, discountPct: 12, freeSurge: true },
  ];
  for (const p of plans) {
    const { id, ...data } = p;
    await prisma.membershipPlan.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // ---- default settings ----
  for (const [key, value] of Object.entries({ 'commission.default': 15, 'gst.rate': 18, 'tax.config': { gstin: '', placeOfSupply: 'MH', hsn: '9954' } })) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: json(value) } });
  }

  // ---- demo partners ----
  const demoPartners = [
    { email: 'partner1@townservices.local', name: 'Ramesh Electrician', town: nashik, lat: 19.9980, lng: 73.7900, svc: serviceIds.filter((i) => /electrician|plumber/.test(i)) },
    { email: 'partner2@townservices.local', name: 'Sunita Home Services', town: nashik, lat: 20.0100, lng: 73.7800, svc: serviceIds.filter((i) => /cleaning|ac-|beauty/.test(i)) },
  ];
  for (const dp of demoPartners) {
    const user = await seedUser(dp.email, dp.name, 'PARTNER', adminPass, dp.town.id);
    const partner = await prisma.partner.upsert({
      where: { userId: user.id },
      update: { kycStatus: 'APPROVED', isOnline: true, lat: dp.lat, lng: dp.lng },
      create: { userId: user.id, kycStatus: 'APPROVED', isOnline: true, lat: dp.lat, lng: dp.lng, radiusKm: 15, ratingAvg: 4.6, ratingCount: 12, acceptanceRate: 0.95, bio: 'Demo partner' },
    });
    for (const serviceId of dp.svc) {
      await prisma.partnerService.upsert({
        where: { partnerId_serviceId: { partnerId: partner.id, serviceId } },
        update: {}, create: { partnerId: partner.id, serviceId },
      });
    }
    // Mon-Sat 09:00-19:00
    await prisma.availabilitySlot.deleteMany({ where: { partnerId: partner.id } });
    await prisma.availabilitySlot.createMany({
      data: [1, 2, 3, 4, 5, 6].map((weekday) => ({ partnerId: partner.id, weekday, startMin: 540, endMin: 1140 })),
    });
  }

  // ---- demo customer ----
  const cust = await seedUser('customer@townservices.local', 'Demo Customer', 'CUSTOMER', adminPass, nashik.id);
  await prisma.customer.upsert({ where: { userId: cust.id }, update: {}, create: { userId: cust.id } });
  await prisma.wallet.upsert({ where: { userId: cust.id }, update: {}, create: { userId: cust.id } });
  await prisma.address.upsert({
    where: { id: 'seed-address-demo' },
    update: {},
    create: { id: 'seed-address-demo', userId: cust.id, label: 'Home', line1: '12 MG Road', city: 'Nashik', pincode: '422001', lat: 19.9990, lng: 73.7910, isDefault: true },
  });

  console.log(`Seed complete. Super admin: ${adminEmail} (towns: ${nashik.name}, ${indore.name}; ${serviceIds.length} services)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
