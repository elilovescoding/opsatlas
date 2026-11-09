import type { User } from './types';
export const canWrite = (user: User | null) => user?.role === 'ADMIN' || user?.role === 'OPERATOR';
