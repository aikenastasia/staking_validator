import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/modal";

import { Action } from "@/types/action";

export default function MintButton(props: { onSubmit: Action }) {
  const { onSubmit } = props;

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [tokenName, setKeyName] = useState("");

  return (
    <>
      <Button className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg grow" radius="full" onPress={onOpen}>
        Mint
      </Button>

      <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Mint</ModalHeader>
              <ModalBody>
                <Input label="Key Name" placeholder="Enter key name" variant="bordered" onValueChange={setKeyName} />
              </ModalBody>
              <ModalFooter>
                <Button
                  className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg"
                  radius="full"
                  onPress={() => onSubmit(tokenName).then(onClose)}
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
