use aiken/collection/dict
use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/script_context.{Publishing, ScriptContext, Spending, Withdrawing}
use cardano/transaction.{OutputReference, Transaction}

validator dry(key: PolicyId) {
  else(ctx: ScriptContext) {
    let ScriptContext { info: script_purpose, transaction: tx, .. } = ctx
    when script_purpose is {
      Spending { .. } | Withdrawing { .. } | Publishing { .. } -> {
        // must consume key
        let input <- list.any(tx.inputs)
        input.output.value |> assets.policies |> list.has(key)
      }
      _ -> False
    }
  }
}

validator key(nonce: OutputReference) {
  mint(_redeemer: Void, policy_id: PolicyId, tx: Transaction) {
    // must mint 1 quantity
    expect [Pair(_, 1)] = tx.mint |> assets.tokens(policy_id) |> dict.to_pairs

    // must consume nonce
    let input <- list.any(tx.inputs)
    input.output_reference == nonce
  }

  else(_) {
    fail
  }
}
