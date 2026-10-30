import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { missingKycDocs, slotsCover, validateSlot } from './partners.rules';

describe('availability rules', () => {
  const existing = [{ id: 's1', weekday: 1, startMin: 540, endMin: 720 }];

  it('rejects start >= end', () => {
    expect(() => validateSlot({ weekday: 1, startMin: 600, endMin: 600 }, [])).toThrow(BadRequestException);
  });
  it('rejects overlap on the same weekday', () => {
    expect(() => validateSlot({ weekday: 1, startMin: 700, endMin: 800 }, existing)).toThrow(/overlaps/);
  });
  it('allows touching edges, other weekdays, and self on update', () => {
    expect(() => validateSlot({ weekday: 1, startMin: 720, endMin: 800 }, existing)).not.toThrow();
    expect(() => validateSlot({ weekday: 2, startMin: 540, endMin: 720 }, existing)).not.toThrow();
    expect(() => validateSlot({ weekday: 1, startMin: 560, endMin: 700 }, existing, 's1')).not.toThrow();
  });
  it('slotsCover: no slots means available; otherwise needs covering slot', () => {
    const at = new Date(2026, 0, 5, 10, 0); // Monday 10:00 local
    expect(slotsCover([], at, 60)).toBe(true);
    expect(slotsCover([{ weekday: 1, startMin: 540, endMin: 720 }], at, 60)).toBe(true);
    expect(slotsCover([{ weekday: 1, startMin: 540, endMin: 630 }], at, 60)).toBe(false);
    expect(slotsCover([{ weekday: 2, startMin: 0, endMin: 1440 }], at, 60)).toBe(false);
  });
});

describe('KYC rules', () => {
  it('missingKycDocs requires AADHAAR and SELFIE', () => {
    expect(missingKycDocs(['PAN'])).toEqual(['AADHAAR', 'SELFIE']);
    expect(missingKycDocs(['AADHAAR', 'SELFIE'])).toEqual([]);
  });

  const make = (kycStatus: string, docTypes: string[]) => {
    const prisma: any = {
      partner: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1', kycStatus, lat: 1, lng: 1 }), update: jest.fn().mockResolvedValue({ id: 'p1', kycStatus: 'SUBMITTED' }) },
      partnerDocument: { findMany: jest.fn().mockResolvedValue(docTypes.map((type) => ({ type }))) },
    };
    return { prisma, svc: new PartnersService(prisma, {} as any, { notify: jest.fn(), notifySafe: jest.fn() } as any) };
  };

  it('submitKyc fails without required docs', async () => {
    const { svc, prisma } = make('PENDING', ['AADHAAR']);
    await expect(svc.submitKyc('u1')).rejects.toThrow(/SELFIE/);
    expect(prisma.partner.update).not.toHaveBeenCalled();
  });
  it('submitKyc moves to SUBMITTED with AADHAAR + SELFIE', async () => {
    const { svc, prisma } = make('PENDING', ['AADHAAR', 'SELFIE']);
    await svc.submitKyc('u1');
    expect(prisma.partner.update).toHaveBeenCalledWith(expect.objectContaining({ data: { kycStatus: 'SUBMITTED' } }));
  });
  it('submitKyc rejects when already submitted', async () => {
    const { svc } = make('SUBMITTED', ['AADHAAR', 'SELFIE']);
    await expect(svc.submitKyc('u1')).rejects.toThrow(BadRequestException);
  });
  it('cannot go online unless KYC approved', async () => {
    const { svc } = make('SUBMITTED', []);
    await expect(svc.setOnline('u1', { online: true })).rejects.toThrow(ForbiddenException);
  });
});
