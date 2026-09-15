export const ROLES = ["management", "sales", "ops", "finance", "trainer", "student"] as const;
export type Role = typeof ROLES[number];
export const permissions = {
 dashboard: ["management", "finance"],
 trace: ["management", "finance", "sales", "ops"],
 crm: ["management", "sales"],
 training: ["management", "ops", "trainer"],
 trainingWrite: ["management", "ops"],
 finance: ["management", "finance"],
 consultant: ["management", "finance"],
 assistant: ["student"],
 accounts: ["management"],
 demo: ["management"],
 // Academic layer: a trainer teaches (posts materials/assignments, grades,
 // queues daily practice) on batches they're assigned to; ops/management
 // can see across all batches the same way they already can for training
 // ops. Students take assignments and see their own grades/materials.
 academicTeach: ["management", "ops", "trainer"],
 academicLearn: ["student"],
} satisfies Record<string, Role[]>;
export type Permission = keyof typeof permissions;
export function can(role: Role, permission: Permission) { return (permissions[permission] as Role[]).includes(role); }
export function homeFor(role: Role) {
 return ({management:"/dashboard",finance:"/finance",sales:"/crm",ops:"/training",trainer:"/training",student:"/assistant"})[role];
}
