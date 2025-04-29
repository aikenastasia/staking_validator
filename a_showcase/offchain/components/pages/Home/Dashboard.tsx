import { Accordion, AccordionItem } from "@heroui/accordion";
import {
  Address,
  applyParamsToScript,
  credentialToRewardAddress,
  Data,
  DRep,
  getAddressDetails,
  Lovelace,
  paymentCredentialOf,
  PoolId,
  RedeemerBuilder,
  scriptHashToCredential,
  SpendingValidator,
  TxSignBuilder,
  UTxO,
  Validator,
  validatorToAddress,
  validatorToRewardAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";

import { network } from "@/config/lucid";
import * as Koios from "@/config/koios";
import { Script } from "@/config/script";
import { ActionGroup } from "@/types/action";
import { SpendValidatorDatumType, SpendValidatorRedeemer, StakeValidatorRedeemerType } from "@/types/withdraw0";
import { useWallet } from "@/components/connection/context";
import OwnerDry from "@/components/actions/OwnerDry";
import Withdraw0 from "@/components/actions/Withdraw0";

export default function Dashboard(props: { setActionResult: (result: string) => void; onError: (error: any) => void }) {
  const [connection] = useWallet();

  if (!connection) return <span className="uppercase">Wallet Disconnected</span>;

  const { api, lucid, address, pkh } = connection;

  async function submitTx(tx: TxSignBuilder) {
    const txSigned = await tx.sign.withWallet().complete();
    const txHash = await txSigned.submit();

    return txHash;
  }

  const actions: Record<string, ActionGroup> = {
    Owner: {
      lock: async (lovelace: Lovelace) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeOwner, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingScriptHash = validatorToScriptHash(stakingValidator);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const spendingValidator: SpendingValidator = { type: "PlutusV3", script: Script.SpendOwner };
          const validatorAddress = validatorToAddress(network, spendingValidator, stakingCredential);

          const tx = await lucid
            .newTx()
            .pay.ToAddress(validatorAddress, { lovelace })
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      unlock: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeOwner, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingScriptHash = validatorToScriptHash(stakingValidator);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const spendingValidator: SpendingValidator = { type: "PlutusV3", script: Script.SpendOwner };
          const validatorAddress = validatorToAddress(network, spendingValidator, stakingCredential);

          const utxos = await lucid.utxosAt(validatorAddress);
          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom(utxos, redeemer)
            .attach.SpendingValidator(spendingValidator)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      delegateStake: async ({ poolID, dRep }: { poolID: PoolId; dRep: DRep }) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeOwner, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .registerAndDelegate.ToPoolAndDRep(stakingAddress, poolID, dRep, redeemer)
            .attach.CertificateValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      withdrawStake: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeOwner, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const { rewards } = await lucid.delegationAt(stakingAddress);

          if (rewards === 0n) throw "No stake rewards yet!";

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .withdraw(stakingAddress, rewards, redeemer)
            .attach.WithdrawalValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      unregisterStake: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeOwner, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .deRegisterStake(stakingAddress, redeemer)
            .attach.CertificateValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },
    },

    DRY: {
      lock: async (lovelace: Lovelace) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeDRY, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingScriptHash = validatorToScriptHash(stakingValidator);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const spendingValidator: SpendingValidator = { type: "PlutusV3", script: Script.SpendDRY };
          const validatorAddress = validatorToAddress(network, spendingValidator, stakingCredential);

          const tx = await lucid
            .newTx()
            .pay.ToAddress(validatorAddress, { lovelace })
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      unlock: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeDRY, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingScriptHash = validatorToScriptHash(stakingValidator);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const spendingValidator: SpendingValidator = { type: "PlutusV3", script: Script.SpendDRY };
          const validatorAddress = validatorToAddress(network, spendingValidator, stakingCredential);

          const utxos = await lucid.utxosAt(validatorAddress);
          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom(utxos, redeemer)
            .attach.SpendingValidator(spendingValidator)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      delegateStake: async ({ poolID, dRep }: { poolID: PoolId; dRep: DRep }) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeDRY, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .registerAndDelegate.ToPoolAndDRep(stakingAddress, poolID, dRep, redeemer)
            .attach.CertificateValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      withdrawStake: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeDRY, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const { rewards } = await lucid.delegationAt(stakingAddress);

          if (rewards === 0n) throw "No stake rewards yet!";

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .withdraw(stakingAddress, rewards, redeemer)
            .attach.WithdrawalValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      unregisterStake: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const stakingScript = applyParamsToScript(Script.StakeDRY, [pkh]);
          const stakingValidator: Validator = { type: "PlutusV3", script: stakingScript };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .deRegisterStake(stakingAddress, redeemer)
            .attach.CertificateValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },
    },

    Withdraw0: {
      init: async ({ spendableAfter, spendableBy }: { spendableAfter: bigint; spendableBy: Address }) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const script = applyParamsToScript(Script.Withdraw0, [pkh]);
          const withdraw0: Validator = { type: "PlutusV3", script };

          const stakingScriptHash = validatorToScriptHash(withdraw0);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const validatorAddress = validatorToAddress(network, withdraw0, stakingCredential);

          const spendValidatorDatum: SpendValidatorDatumType = {
            spendableAfter,
            spendableBy: `${getAddressDetails(spendableBy).paymentCredential?.hash}`,
          };
          const datum = Data.to(spendValidatorDatum, SpendValidatorDatumType);

          const tx = await lucid
            .newTx()
            .pay.ToContract(validatorAddress, { kind: "inline", value: datum })
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      lock: async ({ inputUTXOs, outputLovelaces }: { inputUTXOs: UTxO[]; outputLovelaces: Lovelace[] }) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          if (outputLovelaces.length != inputUTXOs.length) throw "outputLovelaces.length != inputUTXOs.length";

          const script = applyParamsToScript(Script.Withdraw0, [pkh]);
          const withdraw0: Validator = { type: "PlutusV3", script };

          const stakingScriptHash = validatorToScriptHash(withdraw0);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);
          const stakingAddress = credentialToRewardAddress(network, stakingCredential);

          const spendValidatorRedeemer = SpendValidatorRedeemer.In;
          const stakeValidatorRedeemer: RedeemerBuilder = {
            kind: "selected",
            makeRedeemer: (inputIdxs: bigint[]) =>
              Data.to(
                {
                  inputIdxs, // [bigint]
                  outputIdxs: inputIdxs.map((_, i) => {
                    return BigInt(i); // convert number to bigint
                  }),
                },
                StakeValidatorRedeemerType, // { [inputIdx], [outputIdx] }
              ),
            inputs: inputUTXOs,
          };

          let newTx = lucid.newTx();

          inputUTXOs.forEach(({ address, datum, scriptRef }, i) => {
            newTx = newTx.pay.ToContract(address, { kind: "inline", value: `${datum}` }, { lovelace: outputLovelaces[i] }, scriptRef ?? undefined);
          });

          const { rewards } = await lucid.delegationAt(stakingAddress);
          // we could no-longer simply withdraw zero; if rewards have been accumulated we would have to withdraw the accumulated amount of rewards
          // https://github.com/Anastasia-Labs/design-patterns/blob/main/stake-validator/STAKE-VALIDATOR-TRICK.md#important-considerations
          const tx = await newTx
            .collectFrom(inputUTXOs, spendValidatorRedeemer)
            .withdraw(stakingAddress, rewards, stakeValidatorRedeemer)
            .attach.Script(withdraw0)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      unlock: async (fromSender: Address) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          //#region Sender
          const senderPKH = paymentCredentialOf(fromSender).hash;
          const senderScript = applyParamsToScript(Script.Withdraw0, [senderPKH]);
          const senderWithdraw0: Validator = { type: "PlutusV3", script: senderScript };

          const senderStakingScriptHash = validatorToScriptHash(senderWithdraw0);
          const senderStakingCredential = scriptHashToCredential(senderStakingScriptHash);

          const senderValidatorAddress = validatorToAddress(network, senderWithdraw0, senderStakingCredential);
          //#endregion

          //#region Own
          const ownScript = applyParamsToScript(Script.Withdraw0, [pkh]);
          const ownWithdraw0: Validator = { type: "PlutusV3", script: ownScript };

          const ownStakingScriptHash = validatorToScriptHash(ownWithdraw0);
          const ownStakingCredential = scriptHashToCredential(ownStakingScriptHash);

          const ownValidatorAddress = validatorToAddress(network, ownWithdraw0, ownStakingCredential);
          //#endregion

          const now = await Koios.getLatestBlockTimeMS();

          const utxos = (await lucid.utxosAt(senderValidatorAddress)).filter(({ datum }) => {
            if (senderValidatorAddress === ownValidatorAddress) return !datum;
            if (!datum) return false;

            const { /* spendableAfter, */ spendableBy } = Data.from(datum, SpendValidatorDatumType);

            return /* now > spendableAfter && */ pkh === spendableBy;
          });

          const tx = await lucid
            .newTx()
            .collectFrom(utxos, SpendValidatorRedeemer.Out)
            .attach.SpendingValidator(senderWithdraw0)
            .addSigner(address)
            .validFrom(now)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      delegateStake: async ({ poolID, dRep }: { poolID: PoolId; dRep: DRep }) => {
        try {
          const script = applyParamsToScript(Script.Withdraw0, [pkh]);

          const stakingValidator: Validator = { type: "PlutusV3", script };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const stakeValidatorRedeemer: StakeValidatorRedeemerType = { inputIdxs: [], outputIdxs: [] };
          const redeemer = Data.to(stakeValidatorRedeemer, StakeValidatorRedeemerType);

          const tx = await lucid
            .newTx()
            .registerAndDelegate.ToPoolAndDRep(stakingAddress, poolID, dRep, redeemer)
            .attach.CertificateValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      withdrawStake: async () => {
        try {
          const script = applyParamsToScript(Script.Withdraw0, [pkh]);

          const stakingValidator: Validator = { type: "PlutusV3", script };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const { rewards } = await lucid.delegationAt(stakingAddress);

          if (rewards === 0n) throw "No stake rewards yet!";

          const stakeValidatorRedeemer: StakeValidatorRedeemerType = { inputIdxs: [], outputIdxs: [] };
          const redeemer = Data.to(stakeValidatorRedeemer, StakeValidatorRedeemerType);

          const tx = await lucid
            .newTx()
            .withdraw(stakingAddress, rewards, redeemer)
            .attach.WithdrawalValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      unregisterStake: async () => {
        try {
          const script = applyParamsToScript(Script.Withdraw0, [pkh]);

          const stakingValidator: Validator = { type: "PlutusV3", script };
          const stakingAddress = validatorToRewardAddress(network, stakingValidator);

          const stakeValidatorRedeemer: StakeValidatorRedeemerType = { inputIdxs: [], outputIdxs: [] };
          const redeemer = Data.to(stakeValidatorRedeemer, StakeValidatorRedeemerType);

          const tx = await lucid
            .newTx()
            .deRegisterStake(stakingAddress, redeemer)
            .attach.CertificateValidator(stakingValidator)
            .addSigner(address)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },
    },
  };

  return (
    <div className="flex flex-col gap-2">
      <span>{address}</span>

      <Accordion variant="splitted">
        {/* Owner */}
        <AccordionItem key="1" aria-label="Accordion 1" title="Owner">
          <OwnerDry
            onDelegateStake={actions.Owner.delegateStake}
            onLock={actions.Owner.lock}
            onUnlock={actions.Owner.unlock}
            onUnregisterStake={actions.Owner.unregisterStake}
            onWithdrawStake={actions.Owner.withdrawStake}
          />
        </AccordionItem>

        {/* DRY */}
        <AccordionItem key="2" aria-label="Accordion 2" title="DRY">
          <OwnerDry
            onDelegateStake={actions.DRY.delegateStake}
            onLock={actions.DRY.lock}
            onUnlock={actions.DRY.unlock}
            onUnregisterStake={actions.DRY.unregisterStake}
            onWithdrawStake={actions.DRY.withdrawStake}
          />
        </AccordionItem>

        {/* Withdraw0 */}
        <AccordionItem key="3" aria-label="Accordion 3" title="Withdraw Zero Trick">
          <Withdraw0
            onDelegateStake={actions.Withdraw0.delegateStake}
            onError={props.onError}
            onInit={actions.Withdraw0.init}
            onLock={actions.Withdraw0.lock}
            onUnlock={actions.Withdraw0.unlock}
            onUnregisterStake={actions.Withdraw0.unregisterStake}
            onWithdrawStake={actions.Withdraw0.withdrawStake}
          />
        </AccordionItem>
      </Accordion>
    </div>
  );
}
