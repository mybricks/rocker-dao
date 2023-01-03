/*!
 * Rocker-Dao
 *
 * An database dao framework for mysql
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */
import { Env } from "./src/ds";

Env.bootstrapPath = module.parent["filename"];
export { DOBase, Env, getConnection } from "./src/ds";
export * from "./src/main";
