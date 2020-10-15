import {
  Amount,
  AmountUnit,
  Cell,
  Collector,
  Script,
  OutPoint
} from "@lay2/pw-core";

export default class IndexerCollector extends Collector {
  constructor(indexerUrl) {
    super();
    this.indexer = indexerUrl;
  }

  async getBalance(address, sudtTypeScript = null) {
    /**
     * res format sample
     * {
     *  "jsonrpc":"2.0",
     *  "result":{
     *    "block_hash":"0x099ac02990dc770a983625c69e6d82d9cd7875d49d08dcd008a02745859c16cf",
     *    "block_number":"0x898a7",
     *    "capacity":"0x9eb2866bc"
     *   },
     *  "id":2
     *  }
     */
    const res = await rpcRequest(
      this.indexer,
      "get_cells_capacity",
      address.toLockScript()
    );
    if (sudtTypeScript) {
    }

    return new Amount(res.result.capacity, AmountUnit.shannon);
  }

  async collect(address, amount, sudtTypeHash = null) {
    const cells = [];
    let curAmount = Amount.ZERO;
    let lastCursor = null;
    do {
      const res = await rpcRequest(
        this.indexer,
        "get_cells",
        address.toLockScript(),
        "lock",
        lastCursor
      );

      const rawCells = res.result.objects;
      lastCursor = res.result.last_cursor;
      cells.push(
        rawCells.map(rc => {
          const c = new Cell(
            new Amount(rc.output.capacity, AmountUnit.shannon),
            Script.fromRPC(rc.output.lock),
            Script.fromRPC(rc.output.type),
            OutPoint.fromRPC(rc.out_point),
            rc.output_data
          );
          curAmount = curAmount.add(c.capacity);
          return c;
        })
      );
    } while (curAmount.lt(amount));
  }
}

async function rpcRequest(
  rpcUrl,
  methodName,
  script,
  scriptType,
  lastCursor = null
) {
  return (
    await fetch(rpcUrl, {
      method: "POST",
      body: JSON.stringify(
        getRpcParams(methodName, script, scriptType, lastCursor)
      ),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      mode: "cors"
    })
  ).json();
}

function getRpcParams(methodName, script, scriptType, lastCursor) {
  return {
    id: 2,
    jsonrpc: "2.0",
    method: methodName,
    params: [
      {
        script,
        script_type: scriptType
      },
      "asc",
      "0x64", // 100
      lastCursor
    ]
  };
}
