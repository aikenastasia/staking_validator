import { Button } from "@heroui/button";
import {
  applyParamsToScript,
  Constr,
  Data,
  DRep,
  fromText,
  Lovelace,
  MintingPolicy,
  mintingPolicyToId,
  PoolId,
  scriptHashToCredential,
  toUnit,
  TxSignBuilder,
  Validator,
  validatorToAddress,
  validatorToRewardAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";

import { network } from "@/config/lucid";
import { Script } from "@/config/script";
import { ActionGroup } from "@/types/action";
import { useWallet } from "@/components/connection/context";
import MintButton from "@/components/actions/Mint";
import LockButton from "@/components/actions/Lock";
import DelegateStakeButton from "@/components/actions/DelegateStake";
import RedelegateStakeButton from "@/components/actions/RedelegateStake";

export default function Dashboard(props: { setActionResult: (result: string) => void; onError: (error: any) => void }) {
  const [connection] = useWallet();

  if (!connection) return <span className="uppercase">Wallet Disconnected</span>;

  const { api, lucid, address } = connection;

  async function submitTx(tx: TxSignBuilder) {
    const txSigned = await tx.sign.withWallet().complete();
    const txHash = await txSigned.submit();

    return txHash;
  }

  const actions: Record<string, ActionGroup> = {
    DRY: {
      mint: async (tokenName: string) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const utxos = await lucid.wallet().getUtxos();

          if (!utxos) throw "Empty Wallet";

          const nonce = utxos[0];
          const oRef = new Constr(0, [String(nonce.txHash), BigInt(nonce.outputIndex)]);

          const script = applyParamsToScript(Script.KEY, [oRef]);
          const key: MintingPolicy = { type: "PlutusV3", script };

          const policyID = mintingPolicyToId(key);
          const assetName = fromText(tokenName);
          const assetUnit = toUnit(policyID, assetName);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom([nonce])
            .mintAssets({ [assetUnit]: 1n }, redeemer)
            .attach.MintingPolicy(key)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx)
            .then((result) => {
              localStorage.setItem("stake_exercise.dry_policyid", policyID);
              localStorage.setItem("stake_exercise.dry_assetname", assetName);
              props.setActionResult(result);
            })
            .catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      lock: async (lovelace: Lovelace) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const policyID = localStorage.getItem("stake_exercise.dry_policyid");

          if (!policyID) throw "No key data in the current session. Mint a key NFT first!";

          const script = applyParamsToScript(Script.DRY, [policyID]);
          const dry: Validator = { type: "PlutusV3", script };

          const stakingScriptHash = validatorToScriptHash(dry);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const validatorAddress = validatorToAddress(network, dry, stakingCredential);

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

          const policyID = localStorage.getItem("stake_exercise.dry_policyid");
          const assetName = localStorage.getItem("stake_exercise.dry_assetname");

          if (!policyID || !assetName) throw "No key data in the current session. Mint a key NFT first!";

          const script = applyParamsToScript(Script.DRY, [policyID]);
          const dry: Validator = { type: "PlutusV3", script };

          const stakingScriptHash = validatorToScriptHash(dry);
          const stakingCredential = scriptHashToCredential(stakingScriptHash);

          const validatorAddress = validatorToAddress(network, dry, stakingCredential);

          const key = toUnit(policyID, assetName);
          const [keyUTxO] = await lucid.utxosAtWithUnit(address, key);

          const validatorUTXOs = await lucid.utxosAt(validatorAddress);
          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom([keyUTxO, ...validatorUTXOs], redeemer)
            .attach.SpendingValidator(dry)
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

          const policyID = localStorage.getItem("stake_exercise.dry_policyid");
          const assetName = localStorage.getItem("stake_exercise.dry_assetname");

          if (!policyID || !assetName) throw "No key data in the current session. Mint a key NFT first!";

          const script = applyParamsToScript(Script.DRY, [policyID]);
          const dry: Validator = { type: "PlutusV3", script };

          const stakingAddress = validatorToRewardAddress(network, dry);

          const key = toUnit(policyID, assetName);
          const [keyUTxO] = await lucid.utxosAtWithUnit(address, key);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom([keyUTxO])
            .registerAndDelegate.ToPoolAndDRep(stakingAddress, poolID, dRep, redeemer)
            .attach.CertificateValidator(dry)
            .validTo(new Date().getTime() + 15 * 60_000) // ~15 minutes
            .complete();

          submitTx(tx).then(props.setActionResult).catch(props.onError);
        } catch (error) {
          props.onError(error);
        }
      },

      redelegateStake: async (poolID: PoolId) => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const policyID = localStorage.getItem("stake_exercise.dry_policyid");
          const assetName = localStorage.getItem("stake_exercise.dry_assetname");

          if (!policyID || !assetName) throw "No key data in the current session. Mint a key NFT first!";

          console.log({ poolID });

          throw "TODO: Implement stake redelegation action handler!";
        } catch (error) {
          props.onError(error);
        }
      },

      withdrawStake: async () => {
        try {
          if (!lucid.wallet()) lucid.selectWallet.fromAPI(api);

          const policyID = localStorage.getItem("stake_exercise.dry_policyid");
          const assetName = localStorage.getItem("stake_exercise.dry_assetname");

          if (!policyID || !assetName) throw "No key data in the current session. Mint a key NFT first!";

          const script = applyParamsToScript(Script.DRY, [policyID]);
          const dry: Validator = { type: "PlutusV3", script };

          const stakingAddress = validatorToRewardAddress(network, dry);

          const { rewards } = await lucid.delegationAt(stakingAddress);

          if (rewards === 0n) throw "No stake rewards yet!";

          const key = toUnit(policyID, assetName);
          const [keyUTxO] = await lucid.utxosAtWithUnit(address, key);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom([keyUTxO])
            .withdraw(stakingAddress, rewards, redeemer)
            .attach.WithdrawalValidator(dry)
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

          const policyID = localStorage.getItem("stake_exercise.dry_policyid");
          const assetName = localStorage.getItem("stake_exercise.dry_assetname");

          if (!policyID || !assetName) throw "No key data in the current session. Mint a key NFT first!";

          const script = applyParamsToScript(Script.DRY, [policyID]);
          const dry: Validator = { type: "PlutusV3", script };

          const stakingAddress = validatorToRewardAddress(network, dry);

          const key = toUnit(policyID, assetName);
          const [keyUTxO] = await lucid.utxosAtWithUnit(address, key);

          const redeemer = Data.void();

          const tx = await lucid
            .newTx()
            .collectFrom([keyUTxO])
            .deRegisterStake(stakingAddress, redeemer)
            .attach.CertificateValidator(dry)
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

      <div className="flex flex-wrap gap-2">
        <span className="w-4 my-auto">1.</span>
        <MintButton onSubmit={actions.DRY.mint} />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="w-4 my-auto">2.</span>

        <LockButton onSubmit={actions.DRY.lock} />

        <Button className="bg-gradient-to-tr from-primary-500 to-teal-500 text-white shadow-lg grow" radius="full" onPress={actions.DRY.unlock}>
          Unlock
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="w-4 my-auto">3.</span>

        <DelegateStakeButton onSubmit={actions.DRY.delegateStake} />

        <RedelegateStakeButton onSubmit={actions.DRY.redelegateStake} />

        <Button className="bg-gradient-to-tr from-slate-500 to-emerald-500 text-white shadow-lg grow" radius="full" onPress={actions.DRY.withdrawStake}>
          Withdraw Stake Rewards
        </Button>

        <Button className="bg-gradient-to-tr from-slate-500 to-emerald-500 text-white shadow-lg grow" radius="full" onPress={actions.DRY.unregisterStake}>
          Deregister Stake
        </Button>
      </div>
    </div>
  );
}
