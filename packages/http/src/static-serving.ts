/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { http } from './decorator';
import { join } from 'path';
import { readFileSync, stat } from 'fs';
import { HtmlResponse, httpWorkflow } from './http';
import { AppModule } from '@deepkit/app';
import { normalizeDirectory } from './utils';
import { ClassType, urlJoin } from '@deepkit/core';
import { injectable } from '@deepkit/injector';
import { HttpRequest, HttpResponse } from './model';
import send from 'send';
import { eventDispatcher } from '@deepkit/event';
import { RouteConfig, Router } from './router';

export function serveStaticListener(module: AppModule<any>, path: string, localPath: string = path): ClassType {
    @injectable
    class HttpRequestStaticServingListener {
        serve(path: string, request: HttpRequest, response: HttpResponse) {
            return new Promise((resolve, reject) => {
                const res = send(request, path, { root: localPath });
                res.pipe(response);
                res.on('end', resolve);
            });
        }

        @eventDispatcher.listen(httpWorkflow.onRoute, 101) //after default route listener at 100
        onRoute(event: typeof httpWorkflow.onRoute.event) {
            if (event.sent) return;
            if (event.route) return;

            if (!event.request.url?.startsWith(path)) return;

            const relativePath = urlJoin('/', event.url.substr(path.length));
            const finalLocalPath = join(localPath, relativePath);

            return new Promise(resolve => {
                stat(finalLocalPath, (err, stat) => {
                    if (stat && stat.isFile()) {
                        event.routeFound(
                            new RouteConfig('static', ['GET'], event.url, {
                                controller: HttpRequestStaticServingListener,
                                module,
                                methodName: 'serve'
                            }),
                            () => [relativePath, event.request, event.response]
                        );
                    }
                    resolve(undefined);
                });
            });
        }
    }

    return HttpRequestStaticServingListener;
}

function loadHtml(localPath: string, path: string): string {
    try {
        let indexHtml = readFileSync(join(localPath, 'index.html')).toString('utf8');
        indexHtml = indexHtml.replace('<base href="/">', `<base href="${path}">`);
        return indexHtml;
    } catch (error) {
        return '';
    }
}

export interface StaticHttpOptions {
    /**
     * The public URL path.
     */
    path: string;

    /**
     * The local path from the file system. Either relative or absolute.
     */
    localPath: string;

    groups?: string[];

    /**
     * The controller name of the registered controller class. Is per default `StaticController`.
     */
    controllerName?: string;

    /**
     * Replaces strings in the served index.html file.
     */
    indexReplace?: { [name: string]: string };
}

/**
 * Serves an index file and allows to load asset files from the same folder. Can be used to serve an angular application
 *
 * All paths like <path>/*.* that don't match a file are redirected to ${localPath}/index.html.
 * All paths like <path>/*.* that match a file resolve to the file.
 */
export function registerStaticHttpController(module: AppModule<any>, options: StaticHttpOptions): void {
    let indexHtml = '';

    const groups = options.groups || [];

    class StaticController {
        @http.GET().group(...groups)
        serveIndex(request: HttpRequest, response: HttpResponse) {
            if (!indexHtml) {
                indexHtml = loadHtml(options.localPath, normalizeDirectory(options.path));
                if (options.indexReplace) {
                    for (const [k, v] of Object.entries(options.indexReplace)) {
                        indexHtml = indexHtml.replace(k, v);
                    }
                }
            }
            return indexHtml ? new HtmlResponse(indexHtml) : new HtmlResponse('Index not found', 404);
        }
    }

    if (options.controllerName) {
        Object.defineProperty(StaticController, 'name', { value: options.controllerName, writable: true });
    }

    const route1 = new RouteConfig('static', ['GET'], normalizeDirectory(options.path), {
        controller: StaticController,
        module,
        methodName: 'serveIndex'
    });
    route1.groups = groups;
    module.setupGlobalProvider(Router).addRoute(route1);

    const route2 = new RouteConfig('static', ['GET'], normalizeDirectory(options.path).slice(0, -1), {
        controller: StaticController,
        module,
        methodName: 'serveIndex'
    });
    route2.groups = groups;
    module.setupGlobalProvider(Router).addRoute(route2);

    module.addProvider(StaticController);
    module.addListener(serveStaticListener(module, normalizeDirectory(options.path), options.localPath));
}
