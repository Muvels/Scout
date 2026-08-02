# Publication and Release Status

The repository owner approved publication of Scout's source repository on
2026-08-03. This approval does not authorize an official binary release or the
publication of TBF.

## Repository history

Scout's former standalone root contained an obsolete Apache-2.0 license and
TBF-specific notice. With the repository owner's explicit approval, `main` was
replaced with a clean root commit containing the intended Scout license. The
obsolete commit is not an ancestor of public `main`.

Before publication, the remote was audited for branches, tags, pull requests,
releases, and downloadable artifacts; none referenced the former history.
GitHub may retain unreachable commit objects after a force-push. The owner was
informed of that residual risk and explicitly approved publication of the
existing repository.

## Preserved TBF history

The private TBF repository retains Scout's original subtree and history. Before
TBF is published, its public history and archives must exclude the historical
Scout subtree unless the Scout owner deliberately approves releasing those
versions under their historical terms. This repository must not modify the
preserved TBF checkout.

## Binary-release checklist

- Confirm the future legal entity, if any, and update the copyright/licensor
  information deliberately.
- Complete the binary compliance gate in `THIRD_PARTY_NOTICES.md`.
- Complete signing, notarization, update, and distribution checks.
- Put the contributor agreement in place before accepting outside code.
- Obtain explicit approval before publishing any official application binary.
