# Search evaluation fixtures

Ten short texts that share ambiguous headwords but live in unrelated domains.
Use them to verify that Atlas search retrieves the intended sense.

| File | Ambiguous word | Sense |
|------|----------------|-------|
| `01-apple-orchard-cider.txt` | Apple | Fruit / orchard / cider |
| `02-apple-cupertino-roadmap.txt` | Apple | Technology company |
| `03-java-virtual-machine.txt` | Java | Programming language / JVM |
| `04-java-island-coffee-trade.txt` | Java | Indonesian island / coffee |
| `05-commercial-bank-lending.txt` | Bank | Financial institution |
| `06-riverbank-riparian-ecology.txt` | Bank | River shore |
| `07-tower-crane-construction.txt` | Crane | Construction machine |
| `08-whooping-crane-migration.txt` | Crane | Migratory bird |
| `09-mercury-innermost-planet.txt` | Mercury | Planet |
| `10-mercury-metal-toxicity.txt` | Mercury | Chemical element Hg |

## Suggested queries

```text
heirloom cider tannin orchard frost
Cupertino keynote App Store silicon wafer
garbage collection bytecode JIT heap
monsoon batik Borobudur coffee elevation
revolving credit collateral covenant deposits
riparian willow sediment spawning gravel
tower crane load chart rebar outrigger
whooping crane Platte marsh transmitter
spin-orbit resonance innermost planet transit
mercury vapor chelation amalgam spill kit
```

Ambiguous single-word queries (`apple`, `java`, `bank`, `crane`, `mercury`)
should return a mix; sense-rich queries should rank the matching document first.
