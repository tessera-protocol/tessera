# Whitepaper Rewrite Notes

## Major structural changes

- Rebuilt the paper around ambient authority as the core problem.
- Moved from a protocol-first narrative to a capability-security narrative.
- Added explicit sections for:
  - executive summary
  - thesis
  - what Tessera is / is not
  - enforcement boundary
  - runtime-native architecture
  - auditability and decision trace
  - policy model and role templates
  - deployment model
- Tightened the roadmap around present-tense product reality rather than broad protocol ambition.

## Key thesis changes

- Old thesis: Tessera as a broad authorisation protocol centered on human root credentials and agent identity.
- New thesis: Tessera is a capability-based security layer for agent actions.
- Identity language was preserved, but subordinated to authority and capabilities.
- Revocation and auditability were elevated from supporting features to core differentiators.

## Sections removed or substantially cut

- Reduced the protocol-layer identity stack as the backbone of the paper.
- Cut or de-emphasized:
  - universal trust-protocol rhetoric
  - crypto-coded language
  - early infrastructure claims in the present tense
  - broad open-protocol ideology as the main story
  - privacy-centric framing as a central pillar for this version
  - business-model detail that outran current product maturity

## Sections added

- `What Tessera Is Not`
- `Enforcement Boundary`
- `Runtime-Native Architecture`
- `Auditability and Decision Trace`
- `Policy Model and Role Templates`
- `Deployment Model`

## Language intentionally de-emphasized

- blockchain / ledger language
- manifesto-style “future of trust” phrasing
- universal identity framing
- claims that Tessera is already infrastructure
- semantic safety claims the product does not currently support

## Editorial intent

The rewrite is meant to make the paper feel narrower, more security-native, and more adoption-oriented:

- scoped capabilities
- runtime enforcement
- instant revocation
- auditability
- managed first, federated later
- role templates over manual policy authoring
