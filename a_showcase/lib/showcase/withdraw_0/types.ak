use aiken/crypto.{VerificationKeyHash}

// ## SpendValidator

pub type SpendValidatorDatum {
  spendable_after: Int,
  spendable_by: VerificationKeyHash,
}

pub type SpendValidatorRedeemer {
  In
  Out
}

// ## StakeValidator

pub type StakeValidatorRedeemer {
  input_idxs: List<Int>,
  output_idxs: List<Int>,
}
