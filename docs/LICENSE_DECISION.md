# License decision

The owner explicitly approved the **MIT License** during release-readiness review.
`LICENSE` uses the owner's confirmed public GitHub handle for its copyright notice.
No private email or local operating-system username is needed in the license.

MIT is short and permissive: reuse, modification, redistribution, and commercial
use are allowed when the copyright/license notice is retained. It provides no
warranty. Derivative works do not have to publish their source, and MIT does not
contain Apache 2.0's explicit patent grant/termination provisions. This makes it
a straightforward choice for an educational software-engineering portfolio.

Apache 2.0 would also be suitable for permissive reuse, with explicit patent terms
and additional change/notice requirements. A copyleft license such as GPL would
place stronger conditions on distributed derivatives. The owner chose MIT after
those tradeoffs were explained; publication remains a separate decision.

References: [MIT terms](https://choosealicense.com/licenses/mit/),
[Apache 2.0 terms](https://www.apache.org/licenses/LICENSE-2.0).
Dependency licenses remain separate and must be preserved when distributing
their code or binaries. The review ZIP contains source/lockfiles, not vendored
dependency implementations or built container images.
