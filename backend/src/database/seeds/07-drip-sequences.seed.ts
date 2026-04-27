import { DataSource } from 'typeorm';
import { DripSequence } from '../../drip/entities/drip-sequence.entity';
import { DripStep, StepCondition } from '../../drip/entities/drip-step.entity';
import { DripEnrollment, EnrollStatus } from '../../drip/entities/drip-enrollment.entity';

export async function seedDripSequences(
  ds: DataSource,
  users: { id: string }[],
  templates: { id: string; userId: string }[],
  contacts: { id: string; userId: string }[],
  sessions: { id: string; userId: string }[],
): Promise<void> {
  const seqRepo = ds.getRepository(DripSequence);
  const stepRepo = ds.getRepository(DripStep);
  const enrollRepo = ds.getRepository(DripEnrollment);

  for (const user of users) {
    const existing = await seqRepo.count({ where: { userId: user.id } });
    if (existing > 0) continue;

    const userTemplates = templates.filter((t) => t.userId === user.id);
    const userContacts = contacts.filter((c) => c.userId === user.id);
    const userSession = sessions.find((s) => s.userId === user.id);

    if (userTemplates.length < 3 || !userSession) continue;

    // Sequence 1: "New Customer Onboarding"
    const seq1 = await seqRepo.save(
      seqRepo.create({
        userId: user.id,
        name: 'New Customer Onboarding',
        isActive: true,
      }),
    );

    await stepRepo.save([
      stepRepo.create({
        sequenceId: seq1.id,
        stepNumber: 1,
        templateId: userTemplates[0].id,
        delayHours: 0,
        condition: StepCondition.ALWAYS,
      }),
      stepRepo.create({
        sequenceId: seq1.id,
        stepNumber: 2,
        templateId: userTemplates[1].id,
        delayHours: 24,
        condition: StepCondition.NO_REPLY,
      }),
      stepRepo.create({
        sequenceId: seq1.id,
        stepNumber: 3,
        templateId: userTemplates[2].id,
        delayHours: 72,
        condition: StepCondition.ALWAYS,
      }),
    ]);

    // Sequence 2: "Ramadan Campaign"
    const seq2 = await seqRepo.save(
      seqRepo.create({
        userId: user.id,
        name: 'Ramadan Campaign',
        isActive: true,
      }),
    );

    await stepRepo.save([
      stepRepo.create({
        sequenceId: seq2.id,
        stepNumber: 1,
        templateId: userTemplates[0].id,
        delayHours: 0,
        condition: StepCondition.ALWAYS,
      }),
      stepRepo.create({
        sequenceId: seq2.id,
        stepNumber: 2,
        templateId: userTemplates[1].id,
        delayHours: 12,
        condition: StepCondition.ALWAYS,
      }),
      stepRepo.create({
        sequenceId: seq2.id,
        stepNumber: 3,
        templateId: userTemplates[2].id,
        delayHours: 24,
        condition: StepCondition.NO_REPLY,
      }),
    ]);

    // Enroll some contacts in seq1
    const enrollContacts = userContacts.slice(0, 10);
    const enrolledAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

    for (let i = 0; i < enrollContacts.length; i++) {
      const status =
        i < 3
          ? EnrollStatus.COMPLETED
          : i < 7
            ? EnrollStatus.ACTIVE
            : EnrollStatus.ACTIVE;

      await enrollRepo.save(
        enrollRepo.create({
          sequenceId: seq1.id,
          contactId: enrollContacts[i].id,
          sessionId: userSession.id,
          currentStep: status === EnrollStatus.COMPLETED ? 3 : Math.min(i % 3 + 1, 3),
          status,
          enrolledAt,
          completedAt: status === EnrollStatus.COMPLETED ? new Date() : undefined,
        }),
      );
    }

    console.log(`  ✓ Seeded 2 drip sequences with enrollments for user ${user.id}`);
  }
}
