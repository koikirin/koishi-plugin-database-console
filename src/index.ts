import { Context, Database, Driver, Schema, Selection, Service, Tables, Types } from 'koishi'
import { resolve } from 'path'
import type { } from '@koishijs/console'
import { deserialize, serialize } from './utils'
import { retrieveSelection } from './retrieve'

// @ts-expect-error
declare module '@koishijs/client' {
  interface Context {
    database: Database<Tables, Types>
  }
}

declare module '@koishijs/console' {
  interface Events {
    'database-console': (action: string, session: string | undefined, table: string, ...args: string[]) => Promise<string | void>
  }
}

class ConsoleDatabase extends Service {
  static name = 'database-console'
  static filter = false
  static inject = ['console', 'database', 'console.services.database']

  constructor(protected ctx: Context) {
    super(ctx, 'database-console')

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    const sessions: Record<string, [Database, () => void, () => void, Promise<void>]> = {}

    this.ctx.console.addListener('database-console', async (action, session, table, ...args) => {
      if (action === 'stats') {
        return serialize(await ctx.database.stats())
      } else if (action === 'dropAll') {
        return await ctx.database.dropAll()
      } else if (action === 'begin') {
        const task = ctx.database.withTransaction(async (db) => {
          return new Promise((resolve, reject) => {
            sessions[session] = [db, resolve, reject, task]
          })
        })
        return
      } else if (action === 'commit') {
        const [, resolve, , task] = sessions[session]
        resolve()
        await task
        delete sessions[session]
        return
      } else if (action === 'rollback') {
        const [, , reject, task] = sessions[session]
        reject()
        await task
        delete sessions[session]
        return
      }
      let callargs: any[] = args.map(deserialize)
      const db = (session && sessions[session]?.[0]) ?? ctx.database
      // @ts-expect-error
      const driver: Driver = db.getDriver(table)
      await driver.database.prepared()
      await driver._ensureSession()

      if (callargs[0] && Selection.is(callargs[0])) {
        callargs[0] = retrieveSelection(callargs[0], driver)
        callargs = [callargs[0], ...callargs[0].args]
      }
      const result = await (driver[action as any] as any)(...callargs)
      return result && serialize(result)
    }, { authority: 4 })
  }
}

namespace ConsoleDatabase {
  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default ConsoleDatabase
