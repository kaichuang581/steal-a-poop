import type { Route } from '../contracts';
import { routes as accounts } from './accounts';
import { routes as friends } from './friends';
import { routes as moderation } from './moderation';
import { routes as ops } from './ops';
import { routes as rooms } from './rooms';

/** Every lane's routes. This file is finished: lanes edit their own file, never this one. */
export const allRoutes: Route[] = [...accounts, ...friends, ...moderation, ...rooms, ...ops];
