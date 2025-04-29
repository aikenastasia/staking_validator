import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/modal";

import { Action } from "@/types/action";

export default function RedelegateStakeButton(props: { onSubmit: Action }) {
  const { onSubmit } = props;

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [poolID, setPoolID] = useState("");

  return (
    <>
      <Button className="bg-gradient-to-tr from-slate-500 to-emerald-500 text-white shadow-lg grow" radius="full" onPress={onOpen}>
        Redelegate Stake
      </Button>

      <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Redelegate Stake</ModalHeader>
              <ModalBody>
                <Input label="Pool ID" placeholder="Enter Pool ID" variant="bordered" onValueChange={setPoolID} />
              </ModalBody>
              <ModalFooter>
                <Button
                  className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg"
                  radius="full"
                  onPress={() => onSubmit(poolID).then(onClose)}
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
