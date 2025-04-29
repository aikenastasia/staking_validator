use aiken/collection/list
use aiken/collection/pairs
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite, Interval, IntervalBound}
use aiken/option
use cardano/address.{Credential}
use cardano/certificate.{Certificate}
use cardano/script_context.{Publishing, ScriptContext, Withdrawing}
use cardano/transaction.{OutputReference, Transaction}
use showcase/withdraw_0/redeemer_indexing
use showcase/withdraw_0/types.{
  In, Out, SpendValidatorDatum, SpendValidatorRedeemer, StakeValidatorRedeemer,
}

// ## `owner` validator

validator owner(pkh: VerificationKeyHash) {
  withdraw(_redeemer: Void, _credential: Credential, tx: Transaction) {
    tx.extra_signatories |> list.has(pkh)
  }

  publish(_redeemer: Void, _certificate: Certificate, tx: Transaction) {
    tx.extra_signatories |> list.has(pkh)
  }

  else(_) {
    fail
  }
}

validator owner_spend {
  spend(
    _datum: Option<Void>,
    _redeemer: Void,
    _o_ref: OutputReference,
    _tx: Transaction,
  ) {
    True
  }

  else(_) {
    fail
  }
}

// ## `dry` validator

validator dry(pkh: VerificationKeyHash) {
  /// Fallback Handler (`else`):
  /// https://aiken-lang.org/language-tour/validators#fallback-handler
  else(ctx: ScriptContext) {
    let ScriptContext { info: script_purpose, transaction: tx, .. } = ctx
    // Destructuring                                               ☝🏻
    // https://aiken-lang.org/language-tour/custom-types#destructuring
    // Renamed fields:
    // - transaction: tx
    // - info: script_purpose
    //           👇🏻
    when script_purpose is {
      Withdrawing { .. } | Publishing { .. } ->
        //              ☝🏻 Alternative pattern-matching (`|`)
        // https://aiken-lang.org/language-tour/custom-types#alternative-patterns
        // To avoid repeating the same bits of logic across multiple branches,
        // Aiken provides a syntax for handling multiple patterns at once using the pipe symbol.
        //
        // Not to be confused with the pipe operator (`|>`)
        // https://aiken-lang.org/language-tour/control-flow#piping
        // It is for passing the result of one function to the arguments of another function.
        //                   👇🏻
        tx.extra_signatories |> list.has(pkh)

      // Other script_purpose:
      _ -> False
    }
  }
}

validator dry_spend {
  else(_) {
    True
  }
}

// ## `withdraw_0` validator

/// Withdraw Zero Trick:
/// https://aiken-lang.org/fundamentals/common-design-patterns#forwarding-validation--other-withdrawal-tricks
validator withdraw_0(pkh: VerificationKeyHash) {
  spend(
    datum: Option<SpendValidatorDatum>,
    redeemer: SpendValidatorRedeemer,
    o_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      In -> {
        // delegate the validations to the staking script,
        // which will only be executed once for the entire transaction
        expect Some(input) = tx.inputs |> transaction.find_input(o_ref)
        pairs.has_key(tx.withdrawals, input.output.address.payment_credential)?
      }

      Out -> {
        // unwrap the valid-from time from Transaction.validity_range
        // taking the inclusivity into account
        expect Interval {
          lower_bound: IntervalBound { bound_type: Finite(time), is_inclusive },
          ..
        } = tx.validity_range
        let time =
          if is_inclusive {
            time
          } else {
            time + 1
          }

        // allow the specified `pkh` from the script param to spend at any time
        // by setting it as the default/fallback value when there's no datum
        let SpendValidatorDatum { spendable_after, spendable_by } =
          option.or_else(
            datum,
            SpendValidatorDatum { spendable_after: time, spendable_by: pkh },
          )

        // must spend after or at the time, and
        // must be signed by the allowed VerificationKeyHash
        and {
          (time >= spendable_after)?,
          list.has(tx.extra_signatories, spendable_by)?,
        }
      }
    }
  }

  /// Transaction Level Validation via Staking Validators:
  /// https://github.com/Anastasia-Labs/design-patterns/blob/main/stake-validator/STAKE-VALIDATOR.md#validating-the-business-logic-at-staking-validator
  else(
    ScriptContext {
      redeemer: stake_validator_redeemer,
      info: script_purpose,
      transaction: tx,
    }: ScriptContext,
  ) {
    when script_purpose is {
      Withdrawing(self_credential) -> {
        // transaction level validation
        expect tx.extra_signatories |> list.has(pkh)

        // destructure the redeemer's inputs & ouputs indices
        expect StakeValidatorRedeemer { input_idxs, output_idxs } =
          stake_validator_redeemer

        // get unique input & output indices
        let unique_input_idxs = input_idxs |> list.unique
        let unique_output_idxs = output_idxs |> list.unique

        // count unique input & output indices
        let unique_input_idxs_length = unique_input_idxs |> list.length
        let unique_output_idxs_length = unique_output_idxs |> list.length

        // input indices length == output indices length == self_credential TxInputs count
        expect unique_input_idxs_length == unique_output_idxs_length
        expect unique_output_idxs_length == {
            let input <- list.count(tx.inputs)
            input.output.address.payment_credential == self_credential
          }

        // Redeemer Indexing Design Pattern:
        // https://github.com/Anastasia-Labs/design-patterns/blob/main/utxo-indexers/UTXO-INDEXERS.md#redeemer-indexing-design-pattern-enhancing-smart-contract-validation-on-cardano
        redeemer_indexing.validate_io_indices(
          tx,
          unique_input_idxs,
          unique_output_idxs,
        )?
      }

      Publishing { .. } -> list.has(tx.extra_signatories, pkh)?

      _ -> fail @"Invalid Purpose"
    }
  }
}
