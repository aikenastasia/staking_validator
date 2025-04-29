import { Constr, Data } from "@lucid-evolution/lucid";

//#region SpendValidator
export const SpendValidatorDatumSchema = Data.Object({
  spendableAfter: Data.Integer(),
  spendableBy: Data.Bytes(),
});
export type SpendValidatorDatumType = Data.Static<typeof SpendValidatorDatumSchema>;
export const SpendValidatorDatumType = SpendValidatorDatumSchema as unknown as SpendValidatorDatumType;

export const SpendValidatorRedeemer = {
  In: Data.to(new Constr(0, [])),
  Out: Data.to(new Constr(1, [])),
};
//#endregion

//#region StakeValidator
export const StakeValidatorRedeemerSchema = Data.Object({
  inputIdxs: Data.Array(Data.Integer()),
  outputIdxs: Data.Array(Data.Integer()),
});
export type StakeValidatorRedeemerType = Data.Static<typeof StakeValidatorRedeemerSchema>;
export const StakeValidatorRedeemerType = StakeValidatorRedeemerSchema as unknown as StakeValidatorRedeemerType;
//#endregion
