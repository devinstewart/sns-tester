# sns-tester
This repo tests the [sns-playload-module](https://www.npmjs.com/package/sns-payload-validator).

The test is run daily at 12:00 UTC for SignatureVersion 1 and at 12:01 for SignatureVersion 2 in a live AWS account using SNS.

If the test is successful, a [status file](https://github.com/devinstewart/sns-tester/blob/main/status) for SignatureVersion 1 or a [status file](https://github.com/devinstewart/sns-tester/blob/main/status-sigV2) for SignatureVersion2 is placed in this repo with the timestamp.  If it fails, the maintainor is notified via SNS \(email).

## Acknowledgements
Oktokit add / commit / push helped by this [gist](https://gist.github.com/cver/96b45f85d81a769d834a738b73d42a5c)
