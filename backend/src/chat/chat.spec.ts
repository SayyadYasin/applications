import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService authorization', () => {
  const booking = { id: 'b1', status: 'ASSIGNED', customer: { userId: 'cust' }, partner: { id: 'p1', userId: 'part' } };
  const make = (b: any = booking) => {
    const prisma: any = {
      booking: { findUnique: jest.fn().mockResolvedValue(b) },
      chatMessage: { create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'm1', ...data })), findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
    };
    return { prisma, svc: new ChatService(prisma) };
  };

  it('allows customer and partner', async () => {
    const { svc } = make();
    await expect(svc.assertParticipant('b1', 'cust')).resolves.toMatchObject({ partnerUserId: 'part' });
    await expect(svc.assertParticipant('b1', 'part')).resolves.toBeDefined();
  });
  it('blocks strangers and persists nothing', async () => {
    const { svc, prisma } = make();
    await expect(svc.send('b1', 'stranger', 'hi')).rejects.toThrow(ForbiddenException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });
  it('admin may read but not write', async () => {
    const { svc } = make();
    await expect(svc.list('b1', 'adm', 'ADMIN', {})).resolves.toBeDefined();
    await expect(svc.send('b1', 'adm', 'hi')).rejects.toThrow(ForbiddenException);
  });
  it('404 for unknown booking; chat closed when cancelled', async () => {
    await expect(make(null).svc.assertParticipant('x', 'cust')).rejects.toThrow(NotFoundException);
    await expect(make({ ...booking, status: 'CANCELLED' }).svc.send('b1', 'cust', 'hi')).rejects.toThrow(/closed/);
  });
  it('persists a message from a participant', async () => {
    const { svc, prisma } = make();
    const { msg } = await svc.send('b1', 'cust', '  hello ');
    expect(msg.body).toBe('hello');
    expect(prisma.chatMessage.create).toHaveBeenCalled();
  });
});
