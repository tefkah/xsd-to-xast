// This file is part of cxsd, copyright (c) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird'

import { Address, FetchOptions, Cache, CacheResult, util } from 'cget'

import { Context } from './Context'
import { Namespace } from './Namespace'
import { Source } from './Source'
import { Parser } from './Parser'

/** Loader handles caching schema definitions and calling parser stages. */

export class Loader {
  constructor(context: Context, options?: FetchOptions) {
    this.context = context
    this.options = util.clone(options)
    this.parser = new Parser(context)
  }

  import(urlRemote: string) {
    var promise = new Promise<Namespace>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject

      this.source = this.importFile(urlRemote)
    })

    return promise
  }

  importFile(urlRemote: string, namespace?: Namespace) {
    var options = this.options
    options.address = new Address(urlRemote)

    var source = Loader.sourceTbl[urlRemote]

    if (!source) {
      source = new Source(urlRemote, this.context, namespace)

      Loader.cache
        .fetch(options)
        .then((cached: CacheResult) => {
          source.updateUrl(urlRemote, cached.address.url)

          return this.parser.init(cached, source, this)
        })
        .then((dependencyList: Source[]) => {
          // TODO: The source could be parsed already if all dependencies
          // (and recursively their dependencies) have been preprocessed.

          if (--this.pendingCount == 0) this.finish()
        })

      Loader.sourceTbl[urlRemote] = source
      ++this.pendingCount
    }

    return source
  }

  private finish() {
    this.parser.resolve()
    this.resolve(this.source.targetNamespace)
  }

  getOptions() {
    return this.options
  }

  private static cache = new Cache('cache/xsd', '_index.xsd')
  private static sourceTbl: { [url: string]: Source } = {}

  private context: Context
  private options: FetchOptions
  private parser: Parser
  private source: Source

  private pendingCount = 0

  private resolve: (result: Namespace) => void
  private reject: (err: any) => void
}
