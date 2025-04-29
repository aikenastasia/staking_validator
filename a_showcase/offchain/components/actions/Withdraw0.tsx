import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { DatePicker } from "@heroui/date-picker";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import * as IntrDate from "@internationalized/date";
import {
  Address,
  AlwaysAbstain,
  AlwaysNoConfidence,
  applyParamsToScript,
  Data,
  DRep,
  Lovelace,
  PoolId,
  scriptHashToCredential,
  UTxO,
  Validator,
  validatorToAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";

import { network } from "@/config/lucid";
import * as Koios from "@/config/koios";
import { Script } from "@/config/script";
import { Action } from "@/types/action";
import { SpendValidatorDatumType } from "@/types/withdraw0";
import { useWallet } from "@/components/connection/context";
import { isDRepCredential } from "@/components/utils";

export default function Withdraw0(props: {
  onInit: Action;
  onLock: Action;
  onUnlock: Action;
  onDelegateStake: Action;
  onWithdrawStake: Action;
  onUnregisterStake: Action;
  onError: (error: any) => void;
}) {
  const [connection] = useWallet();

  if (!connection) return <span className="uppercase">Wallet Disconnected</span>;

  const { lucid, pkh } = connection;

  const { onInit, onLock, onUnlock, onDelegateStake, onWithdrawStake, onUnregisterStake, onError } = props;

  function InitButton() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const localTimeZone = IntrDate.getLocalTimeZone();
    const [now, setNow] = useState(IntrDate.now(localTimeZone));

    const [spendableAfter, setSpendableAfter] = useState(BigInt(now.toDate().getTime()));
    const [spendableBy, setSpendableBy] = useState("");

    useEffect(() => {
      Koios.getLatestBlockTimeMS()
        .then((time) => {
          const now = IntrDate.fromAbsolute(time, localTimeZone);

          setNow(now);

          const epochMS = now.toDate().getTime();

          setSpendableAfter(BigInt(epochMS));
        })
        .catch(onError);
    }, []);

    return (
      <>
        <Button className="bg-gradient-to-tr from-primary-500 to-teal-500 text-white shadow-lg" radius="full" onPress={onOpen}>
          Init
        </Button>

        <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">Init</ModalHeader>
                <ModalBody>
                  <Input label="Beneficiary" placeholder="addr_..." variant="bordered" onValueChange={setSpendableBy} />
                  <DatePicker
                    hideTimeZone
                    showMonthAndYearPickers
                    defaultValue={now}
                    label="Deadline"
                    minValue={now}
                    variant="bordered"
                    onChange={(value) => setSpendableAfter((spendableAfter) => (value ? BigInt(value.toDate().getTime()) : spendableAfter))}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button
                    className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg"
                    radius="full"
                    onPress={() => onInit({ spendableAfter, spendableBy }).then(onClose).catch(onError)}
                  >
                    Submit
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </>
    );
  }

  function LockButton() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const [inputUTXOs, setInputUTXOs] = useState<UTxO[]>();

    useEffect(() => {
      const script = applyParamsToScript(Script.Withdraw0, [pkh]);
      const withdraw0: Validator = { type: "PlutusV3", script };

      const stakingScriptHash = validatorToScriptHash(withdraw0);
      const stakingCredential = scriptHashToCredential(stakingScriptHash);

      const validatorAddress = validatorToAddress(network, withdraw0, stakingCredential);

      lucid.utxosAt(validatorAddress).then(setInputUTXOs).catch(onError);
    }, []);

    async function collectDeposit() {
      const outputLovelaces: Lovelace[] = [];

      inputUTXOs?.forEach(({ assets }, u) => {
        let lovelace = 0n;

        try {
          const { value } = document.getElementById(`utxo.${u}.qty`) as HTMLInputElement;

          lovelace = BigInt(parseFloat(value) * 1_000000);
        } finally {
          outputLovelaces.push(assets.lovelace + lovelace);
        }
      });

      return { inputUTXOs, outputLovelaces };
    }

    return (
      <>
        <Button className="bg-gradient-to-tr from-primary-500 to-teal-500 text-white shadow-lg" radius="full" onPress={onOpen}>
          Lock
        </Button>

        <Modal isOpen={isOpen} placement="top-center" size="5xl" onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">Lock</ModalHeader>
                <ModalBody>
                  {inputUTXOs ? (
                    <Table isStriped aria-label="Deposit">
                      <TableHeader>
                        <TableColumn>Tx Hash</TableColumn>
                        <TableColumn>Output Index</TableColumn>
                        <TableColumn>Beneficiary</TableColumn>
                        <TableColumn>Deadline</TableColumn>
                        <TableColumn>ADA</TableColumn>
                        <TableColumn>Add</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="No rows to display.">
                        {inputUTXOs
                          .filter(({ datum }) => datum)
                          .map(({ txHash, outputIndex, datum, assets }, u) => {
                            if (!datum) return <></>;

                            const { spendableAfter, spendableBy } = Data.from(datum, SpendValidatorDatumType);
                            const deadline = new Date(parseInt(spendableAfter.toString()));

                            return (
                              <TableRow key={`utxo.${u}`}>
                                <TableCell>{`${txHash.slice(0, 4)}...${txHash.slice(-4)}`}</TableCell>
                                <TableCell>{outputIndex}</TableCell>
                                <TableCell>{`${spendableBy.slice(0, 4)}...${spendableBy.slice(-4)}`}</TableCell>
                                <TableCell>{`${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}`}</TableCell>
                                <TableCell>{`${assets.lovelace / 1_000000n}.${assets.lovelace % 1_000000n}`}</TableCell>
                                <TableCell>
                                  <Input
                                    id={`utxo.${u}.qty`}
                                    label="Quantity"
                                    placeholder="0.000000"
                                    startContent={
                                      <div className="pointer-events-none flex items-center">
                                        <span className="text-default-400 text-small">ADA</span>
                                      </div>
                                    }
                                    type="number"
                                    variant="bordered"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Spinner />
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button
                    className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg"
                    radius="full"
                    onPress={() => collectDeposit().then(onLock).then(onClose).catch(onError)}
                  >
                    Submit
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </>
    );
  }

  function UnlockButton() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const [fromSender, setSenderAddress] = useState<Address>(""); // addr_...

    return (
      <>
        <Button className="bg-gradient-to-tr from-primary-500 to-teal-500 text-white shadow-lg" radius="full" onPress={onOpen}>
          Unlock
        </Button>

        <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">Unlock</ModalHeader>
                <ModalBody>
                  <Input label="Sender address" placeholder="addr_..." variant="bordered" onValueChange={setSenderAddress} />
                </ModalBody>
                <ModalFooter>
                  <Button
                    className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg"
                    radius="full"
                    onPress={() => onUnlock(fromSender).then(onClose).catch(onError)}
                  >
                    Submit
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </>
    );
  }

  function DelegateStakeButton() {
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const AlwaysAbstain: AlwaysAbstain = { __typename: "AlwaysAbstain" };
    const AlwaysNoConfidence: AlwaysNoConfidence = { __typename: "AlwaysNoConfidence" };

    const [poolID, setPoolID] = useState<PoolId>("");
    const [dRep, setDrep] = useState<DRep>(AlwaysAbstain);
    const [dRepID, setDrepID] = useState(""); // drep_...
    const [dRepCredentialType, setDrepCredentialType] = useState<"Key" | "Script">("Key");
    const [dRepCredentialHash, setDrepCredentialHash] = useState("");

    useEffect(() => {
      if (!dRepID) return; // skip
      fetch("/koios/drep_info?select=hex,has_script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _drep_ids: [dRepID] }),
      })
        .then((dReps) => dReps.json())
        .then(([{ hex, has_script }]) => {
          const credential: DRep = {
            type: has_script ? "Script" : "Key",
            hash: hex,
          };

          setDrepCredentialType(credential.type);
          setDrepCredentialHash(credential.hash);
          setDrep(credential);
        })
        .catch(console.error);
    }, [dRepID]);

    const Drep: Record<string, () => DRep> = {
      AlwaysAbstain: () => AlwaysAbstain,
      Credential: () => ({ type: dRepCredentialType, hash: dRepCredentialHash }),
      AlwaysNoConfidence: () => AlwaysNoConfidence,
    };

    return (
      <>
        <Button className="bg-gradient-to-tr from-slate-500 to-emerald-500 text-white shadow-lg" radius="full" onPress={onOpen}>
          Delegate Stake
        </Button>

        <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">Delegate Stake</ModalHeader>
                <ModalBody>
                  <Input label="Pool ID" placeholder="Enter Pool ID" variant="bordered" onValueChange={setPoolID} />
                  <Select
                    label="Drep"
                    placeholder="Abstain"
                    variant="bordered"
                    onChange={(e) => setDrep(e.target.value ? Drep[e.target.value]() : AlwaysAbstain)}
                  >
                    <SelectItem key={"AlwaysAbstain"}>Abstain</SelectItem>
                    <SelectItem key={"Credential"}>Credential</SelectItem>
                    <SelectItem key={"AlwaysNoConfidence"}>No confidence</SelectItem>
                  </Select>
                  {isDRepCredential(dRep) && <Input label="Drep ID" placeholder="drep_..." variant="bordered" onValueChange={setDrepID} />}
                </ModalBody>
                <ModalFooter>
                  <div className="relative">
                    <Button
                      className={`bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg
                      ${isDRepCredential(dRep) && dRepID && !dRepCredentialHash && "invisible"}`}
                      isDisabled={isDRepCredential(dRep) && !dRepCredentialHash}
                      radius="full"
                      onPress={() => onDelegateStake({ poolID, dRep }).then(onClose).catch(onError)}
                    >
                      Submit
                    </Button>
                    {isDRepCredential(dRep) && dRepID && !dRepCredentialHash && (
                      <Spinner className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      <DelegateStakeButton />

      <InitButton />

      <LockButton />
      <UnlockButton />

      <Button className="bg-gradient-to-tr from-slate-500 to-emerald-500 text-white shadow-lg" radius="full" onPress={onWithdrawStake}>
        Withdraw Stake Rewards
      </Button>
      <Button className="bg-gradient-to-tr from-slate-500 to-emerald-500 text-white shadow-lg" radius="full" onPress={onUnregisterStake}>
        Deregister Stake
      </Button>
    </div>
  );
}
