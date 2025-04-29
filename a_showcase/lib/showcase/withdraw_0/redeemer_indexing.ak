use aiken/collection/list
use cardano/assets
use cardano/transaction.{Transaction}

pub fn validate_io_indices(
  tx: Transaction,
  input_idxs: List<Int>,
  output_idxs: List<Int>,
) {
  when (input_idxs, output_idxs) is {
    ([], []) -> True
    ([], _) | (_, []) -> fail @"input_idxs.length != output_idxs.length"
    ([input_idx, ..next_input_idxs], [output_idx, ..next_output_idxs]) -> {
      expect Some(input) = tx.inputs |> list.at(input_idx)
      expect Some(output) = tx.outputs |> list.at(output_idx)

      expect and {
          output.address == input.output.address,
          output.datum == input.output.datum,
          output.reference_script == input.output.reference_script,
          output.value |> assets.match(input.output.value, >=),
        }

      validate_io_indices(tx, next_input_idxs, next_output_idxs)
    }
  }
}
