import { IncomingMessage, ServerResponse } from 'http';
import { ClassType } from '@deepkit/core';
import type { AppModule } from './module';
import { BaseEvent, EventToken } from '@deepkit/event';
import { createFreeDecoratorContext, FreeFluidDecorator } from '@deepkit/type';
import { HttpAction } from '../../http';

export type Middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) => void;

export class MiddlewareConfig {
    name?: string;
    middlewares: (Middleware | ClassType)[] = [];

    routes: HttpAction[] = [];
    excludeRoutes: HttpAction[] = [];

    controllers: ClassType[] = [];
    excludeControllers: ClassType[] = [];

    routeNames: string[] = [];
    excludeRouteNames: string[] = [];

    modules: AppModule<any>[] = [];

    eventToken?: EventToken<any>;
}

export class MiddlewareApi {
    t = new MiddlewareConfig;

    name(name: string) {
        this.t.name = name;
    }

    for(...middlewares: (Middleware | ClassType)[]) {
        this.t.middlewares = middlewares;
    }

    forRoutes(...routes: FreeFluidDecorator<HttpAction>[]) {
        this.t.routes = routes.map(v => v());
    }

    excludeRoutes(...routes: FreeFluidDecorator<HttpAction>[]) {
        this.t.excludeRoutes = routes.map(v => v());
    }

    forRouteNames(...names: string[]) {
        this.t.routeNames = names;
    }

    excludeRouteNames(...names: string[]) {
        this.t.excludeRouteNames = names;
    }

    forControllers(...controllers: ClassType[]) {
        this.t.controllers = controllers;
    }

    excludeControllers(...controllers: ClassType[]) {
        this.t.excludeControllers = controllers;
    }

    forModules(...modules: AppModule<any>[]) {
        this.t.modules = modules;
    }

    eventToken<E extends { request: IncomingMessage, response: ServerResponse } & BaseEvent>(eventToken: EventToken<E>) {
        this.t.eventToken = eventToken;
    }
}

export const middleware = createFreeDecoratorContext(MiddlewareApi);
