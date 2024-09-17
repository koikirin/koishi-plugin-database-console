import { Context, defineProperty, mapValues, send, store } from '@koishijs/client'
import minato, { Driver, Model, Schema, Selection } from 'minato'
import { watch } from 'vue'
import type { } from 'koishi-plugin-database-console'
import type { } from 'koishi-plugin-dataview'
import { deserialize, serialize } from './utils'

// @ts-expect-error
export class ConsoleDriver extends Driver<ConsoleDriver.Config> {
  static name = 'console'
  session?: string
  send!: (action: string, session: string | undefined, table: string, ...args: any[]) => Promise<any>
  _counter: number = 0

  async prepare(name: string) {}

  async start() {
    this.send = this.config.send!

    const methods = ['create', 'eval', 'get', 'remove', 'set', 'upsert', 'drop', 'dropAll', 'stats', 'getIndexes', 'createIndex', 'dropIndex'] as const
    for (const method of methods) {
      this[method] = async function (...args: any[]) {
        const arg = args.shift() ?? ''
        const table = typeof arg === 'string' ? arg : getTable(arg)
        if (Selection.is(arg)) arg.tables = mapValues(arg.tables, _ => ({} as any))
        const result = await this.send(method, this.session, table, serialize(arg), ...Selection.is(arg) ? [] : args.map(serialize))
        return result && deserialize(result)
      }
    }
  }

  async stop() {}

  async withTransaction(callback: (session?: any) => Promise<void>): Promise<void> {
    const session = `_tx_${this._counter++}`
    await this.send('begin', session, '')
    try {
      await callback(session)
      await this.send('commit', session, '')
    } catch (e) {
      await this.send('rollback', session, '')
    }
  }

  async prepareIndexes(table: string) {}
}

const getTable = (sel: Selection.Immutable | Selection.Mutable) => {
  return typeof sel.table === 'string' ? sel.table : sel.table.table ? getTable(sel.table as Selection) : getTable(Object.values(sel.table)[0])
}

export namespace ConsoleDriver {
  export interface Config {
    send?: (action: string, session: string | undefined, table: string, ...args: any[]) => Promise<any>
  }

  export const Config: Schema<Config> = Schema.object({})
}

export default (ctx: Context) => {
  // @ts-expect-error
  ctx.plugin(minato)

  let inited = false
  const update = (ctx: Context, tables: any) => {
    ctx.model.tables = mapValues(tables, (table: any) => defineProperty(Object.assign(new Model(table.name), table), 'ctx', ctx))
    if (!inited) {
      ctx.plugin(ConsoleDriver, {
        send: (action, session, table, ...args) => send('database-console', action, session, table, ...args),
      })
      inited = true
    }
  }

  ctx.inject(['model'], async (ctx) => {
    if (store.database) update(ctx, store.database.tables)
    ctx.effect(() => watch(() => store.database, (value) => value && update(ctx, value.tables)))
  })
}
