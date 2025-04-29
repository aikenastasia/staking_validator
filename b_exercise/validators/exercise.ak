use aiken/collection/dict
use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/script_context.{Publishing, ScriptContext, Spending, Withdrawing}
use cardano/transaction.{OutputReference, Transaction}

/// Define a validator that will allow spending and staking actions if the user posseses a key token
/// with the PolicyID specified in the script parameter.
///
/// Optionally, define the staking redelegation action transaction building logic in the offchain.
validator dry(key: PolicyId) {
  else(ctx: ScriptContext) {
    let ScriptContext { info: script_purpose, transaction: tx, .. } = ctx
    when script_purpose is {
      Spending { .. } | Withdrawing { .. } | Publishing { .. } ->
        // consuming a key here means having the UTxO holding the token as a transaction input
        // and not burning the asset
        todo @"must consume key"
      _ -> False
    }
  }
}

/// Define the "One-shot" Minting policy here that will only allow for minting 1 key token.
validator key(nonce: OutputReference) {
  mint(_redeemer: Void, policy_id: PolicyId, tx: Transaction) {
    todo @"must mint 1 quantity"
    todo @"must consume nonce"
  }

  else(_) {
    fail
  }
}
