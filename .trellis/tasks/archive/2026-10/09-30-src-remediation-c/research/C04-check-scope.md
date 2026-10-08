# C04 independent acceptance

Use true full AudioTake rows from getAudioProjectSnapshot, not simplified Pick-only mocks. Current schedule spreads full takes into fingerprint sources; metadata/project/segment/provenance job IDs and key insertion order matter to legacy state. Genuine project and chapter exports viaaddAudioExport with JSON.stringify(buildAudioSchedule) represent v0. New comparison/remap helper must support recognizedold andnewversion formats conservatively.

Originalcurrent→current after2roundtrips, originalstale→stale after2roundtrips including onlysource-name/revision metadata change as well ascliptrim/gain; deletedchapterexport remains chapterhistory/stale; unknownmalformedfingerprint retainedunknown notassertfresh. Validate actualmedia bytes preserved/retrievable; notclaimplayback orrender verification. Canonical object order does noterase historical effects; droppedoptionalmetadata/unknownfields cannot turnstaleintocurrent.

All realconsumers AudioTimeline create, AudioExports compare, audioProjectPackage remap updated together withoutnetwork/decode intransaction. Prior C01/C02/C03 finalhashes protected; audioProjectPackage previouslyC02 ifneededlatermodified thenC04 latestscopefullyreviewed. Staticnoadded/helpercomplexity readable no registries. Beforeafterallchangedfiles, test/lint logs and finalsha snapshots. No blanketrefreshall fingerprints.
