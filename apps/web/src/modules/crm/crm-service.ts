import { getDb } from "@yatra/db/client";

export const crmInteractionTypes = [
  "NOTE",
  "CALL",
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "OTHER",
] as const;

export const crmInteractionDirections = [
  "INTERNAL",
  "INBOUND",
  "OUTBOUND",
] as const;

export type CrmInteractionTypeValue =
  (typeof crmInteractionTypes)[number];
export type CrmInteractionDirectionValue =
  (typeof crmInteractionDirections)[number];

type CrmSubject =
  | { leadId: string; customerUserId?: never; customerEmailNormalized?: never }
  | { leadId?: never; customerUserId: string; customerEmailNormalized?: never }
  | { leadId?: never; customerUserId?: never; customerEmailNormalized: string };

function normalizeSubject(subject: CrmSubject) {
  if (typeof subject.leadId === "string") {
    const leadId = subject.leadId.trim();
    if (!leadId) throw new Error("Lead ID is required.");
    return {
      leadId,
      customerUserId: null,
      customerEmailNormalized: null,
    };
  }

  if (typeof subject.customerUserId === "string") {
    const customerUserId = subject.customerUserId.trim();
    if (!customerUserId) throw new Error("Customer user ID is required.");
    return {
      leadId: null,
      customerUserId,
      customerEmailNormalized: null,
    };
  }

  const customerEmailNormalized = subject.customerEmailNormalized
    .trim()
    .toLowerCase();

  if (
    !customerEmailNormalized ||
    customerEmailNormalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmailNormalized)
  ) {
    throw new Error("A valid customer email is required.");
  }

  return {
    leadId: null,
    customerUserId: null,
    customerEmailNormalized,
  };
}

async function assertSubjectExists(
  subject: ReturnType<typeof normalizeSubject>,
) {
  const db = getDb();

  if (subject.leadId) {
    const lead = await db.lead.findUnique({
      where: { id: subject.leadId },
      select: { id: true },
    });
    if (!lead) throw new Error("Lead not found.");
  }

  if (subject.customerUserId) {
    const user = await db.user.findUnique({
      where: { id: subject.customerUserId },
      select: { id: true },
    });
    if (!user) throw new Error("Customer not found.");
  }
}

export async function createCrmInteraction(input: {
  subject: CrmSubject;
  type: CrmInteractionTypeValue;
  direction: CrmInteractionDirectionValue;
  subjectLine?: string | null;
  body: string;
  occurredAt?: Date;
  actorUserId: string;
}) {
  const body = input.body.trim();
  const subjectLine = input.subjectLine?.trim() || null;

  if (body.length < 1 || body.length > 5000) {
    throw new Error("Interaction body must be between 1 and 5000 characters.");
  }
  if (subjectLine && subjectLine.length > 200) {
    throw new Error("Interaction subject must be 200 characters or fewer.");
  }

  const subject = normalizeSubject(input.subject);
  await assertSubjectExists(subject);

  const db = getDb();
  const interaction = await db.crmInteraction.create({
    data: {
      ...subject,
      type: input.type,
      direction: input.direction,
      subject: subjectLine,
      body,
      occurredAt: input.occurredAt ?? new Date(),
      createdByUserId: input.actorUserId,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "CRM_INTERACTION_CREATED",
      entityType: "CrmInteraction",
      entityId: interaction.id,
      metadata: {
        leadId: subject.leadId,
        customerUserId: subject.customerUserId,
        customerEmailNormalized: subject.customerEmailNormalized,
        type: interaction.type,
        direction: interaction.direction,
      },
    },
  });

  return interaction;
}

export async function createCrmFollowUp(input: {
  subject: CrmSubject;
  title: string;
  notes?: string | null;
  dueAt: Date;
  assignedToUserId?: string | null;
  actorUserId: string;
}) {
  const title = input.title.trim();
  const notes = input.notes?.trim() || null;

  if (title.length < 2 || title.length > 200) {
    throw new Error("Follow-up title must be between 2 and 200 characters.");
  }
  if (notes && notes.length > 5000) {
    throw new Error("Follow-up notes must be 5000 characters or fewer.");
  }

  const subject = normalizeSubject(input.subject);
  await assertSubjectExists(subject);

  const db = getDb();

  if (input.assignedToUserId) {
    const assignee = await db.user.findUnique({
      where: { id: input.assignedToUserId },
      select: { id: true, status: true },
    });
    if (!assignee || assignee.status !== "ACTIVE") {
      throw new Error("Follow-up assignee must be an active user.");
    }
  }

  const task = await db.crmFollowUpTask.create({
    data: {
      ...subject,
      title,
      notes,
      dueAt: input.dueAt,
      assignedToUserId: input.assignedToUserId ?? null,
      createdByUserId: input.actorUserId,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "CRM_FOLLOW_UP_CREATED",
      entityType: "CrmFollowUpTask",
      entityId: task.id,
      metadata: {
        leadId: subject.leadId,
        customerUserId: subject.customerUserId,
        customerEmailNormalized: subject.customerEmailNormalized,
        assignedToUserId: task.assignedToUserId,
        dueAt: task.dueAt.toISOString(),
      },
    },
  });

  return task;
}

export async function completeCrmFollowUp(input: {
  taskId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const current = await tx.crmFollowUpTask.findUnique({
      where: { id: input.taskId },
    });
    if (!current) throw new Error("Follow-up task not found.");
    if (current.status !== "OPEN") {
      throw new Error("Only open follow-up tasks can be completed.");
    }

    const completedAt = new Date();
    const task = await tx.crmFollowUpTask.update({
      where: { id: current.id },
      data: {
        status: "COMPLETED",
        completedAt,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "CRM_FOLLOW_UP_COMPLETED",
        entityType: "CrmFollowUpTask",
        entityId: task.id,
        metadata: { completedAt: completedAt.toISOString() },
      },
    });

    return task;
  });
}

export async function cancelCrmFollowUp(input: {
  taskId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(async (tx) => {
    const current = await tx.crmFollowUpTask.findUnique({
      where: { id: input.taskId },
    });
    if (!current) throw new Error("Follow-up task not found.");
    if (current.status !== "OPEN") {
      throw new Error("Only open follow-up tasks can be cancelled.");
    }

    const task = await tx.crmFollowUpTask.update({
      where: { id: current.id },
      data: {
        status: "CANCELLED",
        completedAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "CRM_FOLLOW_UP_CANCELLED",
        entityType: "CrmFollowUpTask",
        entityId: task.id,
      },
    });

    return task;
  });
}
