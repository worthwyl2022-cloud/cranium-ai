ALTER TABLE `messages`
  ADD COLUMN `correlationId` varchar(64),
  ADD COLUMN `contextEnvelopeHash` varchar(64);
