import { describe, expect, it } from "vitest";

import { parseMoney, parseOrganizationId, parseTick, type SnapshotV2 } from "@landlord/shared";
import { RIVAL_ORGANIZATION_ID, PLAYER_ORGANIZATION_ID } from "./game-data";
import { recordFactionEncounter, rememberFactionAction } from "./factions";
import { recordReputationFact } from "./reputation";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState } from "./state";

function snapshotWithSubsystems(): SnapshotV2 {
  const state = createInitialState(5);
  state.phase2.contracts.contracts.contract_00000001 = {
    id: "contract_00000001",
    kind: "supply",
    title: "Prueba de integridad",
    budget: parseMoney(260),
    bond: parseMoney(26),
    requiredBuildings: 0,
    publishedAtTick: parseTick(0),
    closesAtTick: parseTick(36_000),
    executesAtTick: parseTick(72_000),
    status: "open",
    awardedToOrganizationId: null,
    awardedAmount: null,
    bids: [
      {
        organizationId: RIVAL_ORGANIZATION_ID,
        amount: parseMoney(200),
        atTick: parseTick(0),
      },
    ],
  };
  state.phase2.contracts.reliabilityByOrganizationId[PLAYER_ORGANIZATION_ID] = {
    awarded: 0,
    completed: 0,
    defaulted: 0,
  };
  recordReputationFact(state, PLAYER_ORGANIZATION_ID, "contract_completed");
  state.phase2.intelligence.estimatesBySubjectOrganizationId[RIVAL_ORGANIZATION_ID] = [
    {
      id: "intel_00000001",
      subjectOrganizationId: RIVAL_ORGANIZATION_ID,
      kind: "balance",
      source: "contacts",
      value: 100,
      accuracyPercent: 90,
      atTick: parseTick(0),
    },
  ];
  recordFactionEncounter(state, PLAYER_ORGANIZATION_ID, RIVAL_ORGANIZATION_ID, "tender_contested");
  rememberFactionAction(state, RIVAL_ORGANIZATION_ID, {
    action: "bid_public_contract",
    target: "contract_00000001",
    accepted: true,
    rejectionCode: null,
  });
  return serializeSnapshot(state);
}

function clone(snapshot: SnapshotV2): SnapshotV2 {
  return JSON.parse(JSON.stringify(snapshot)) as SnapshotV2;
}

function expectRejected(mutate: (snapshot: SnapshotV2) => void, path: RegExp): void {
  const snapshot = clone(snapshotWithSubsystems());
  mutate(snapshot);
  expect(() => restoreStateFromSnapshot(snapshot)).toThrow(path);
}

describe("WP4.11-H integridad referencial de snapshots", () => {
  it("un snapshot válido con todos los subsistemas restaura como antes", () => {
    const snapshot = snapshotWithSubsystems();
    const restored = restoreStateFromSnapshot(clone(snapshot));
    expect(serializeSnapshot(restored)).toEqual(snapshot);
  });

  it("rechaza una oferta de contrato de una organización inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.contracts!.contracts.contract_00000001!.bids[0]!.organizationId =
        parseOrganizationId("org_99999999");
    }, /contracts\/contract_00000001\/bids/);
  });

  it("rechaza un adjudicatario inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.contracts!.contracts.contract_00000001!.awardedToOrganizationId =
        parseOrganizationId("org_99999999");
    }, /awardedToOrganizationId/);
  });

  it("rechaza fiabilidad crediticia de una organización inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.contracts!.reliabilityByOrganizationId.org_99999999 = {
        awarded: 0,
        completed: 0,
        defaulted: 0,
      };
    }, /reliabilityByOrganizationId\/org_99999999/);
  });

  it("rechaza reputación de una organización inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.reputation!.standingByOrganizationId.org_99999999 = { residents: 10 };
    }, /reputation\/org_99999999/);
  });

  it("rechaza un observador de inteligencia inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.intelligence!.observerOrganizationId = parseOrganizationId("org_99999999");
    }, /intelligence\/observerOrganizationId/);
  });

  it("rechaza un sujeto de inteligencia inexistente y una clave que no le corresponde", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.intelligence!.estimatesBySubjectOrganizationId.org_99999999 = [];
    }, /estimatesBySubjectOrganizationId\/org_99999999/);
    expectRejected((snapshot) => {
      snapshot.phase2!.intelligence!.estimatesBySubjectOrganizationId[
        RIVAL_ORGANIZATION_ID
      ]![0]!.subjectOrganizationId = PLAYER_ORGANIZATION_ID;
    }, /estimatesBySubjectOrganizationId\/org_00000002\/intel_00000001/);
  });

  it("rechaza una postura de facción mal formada o con organización inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.stanceByPairId["org_00000001>org_99999999"] = -10;
    }, /stanceByPairId/);
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.stanceByPairId["pareja-mal-formada"] = -10;
    }, /stanceByPairId/);
  });

  it("rechaza memoria de facción de una organización inexistente", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.memoryByOrganizationId.org_99999999 = [];
    }, /factions\/org_99999999/);
  });

  /** WP4.11-H.1: existir no basta; el rol reservado a una empresa en un banco es estado corrupto. */
  it("rechaza organizaciones correctas pero del tipo equivocado en los roles de empresa", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.contracts!.reliabilityByOrganizationId.org_00000003 = {
        awarded: 0,
        completed: 0,
        defaulted: 0,
      };
    }, /reliabilityByOrganizationId\/org_00000003/);
    expectRejected((snapshot) => {
      snapshot.phase2!.intelligence!.estimatesBySubjectOrganizationId.org_00000004 = [];
    }, /estimatesBySubjectOrganizationId\/org_00000004/);
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.profileByOrganizationId.org_00000005 = "conservative";
    }, /factions\/org_00000005/);
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.memoryByOrganizationId.org_00000003 = [];
    }, /factions\/org_00000003/);
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.cycleCountByOrganizationId.org_00000004 = 3;
    }, /factions\/org_00000004/);
    expectRejected((snapshot) => {
      snapshot.phase2!.factions!.stanceByPairId["org_00000001>org_00000003"] = -5;
    }, /stanceByPairId/);
  });

  it("rechaza un partido gobernante fuera del catálogo", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.politics!.governingPartyId = "party_fantasma";
    }, /municipal politics references: governingPartyId/);
  });

  it("rechaza escaños o apoyo de un partido fuera del catálogo", () => {
    expectRejected((snapshot) => {
      snapshot.phase2!.politics!.seatsByPartyId.party_fantasma = 1;
    }, /seatsByPartyId\/party_fantasma/);
    expectRejected((snapshot) => {
      snapshot.phase2!.politics!.supportPercentByPartyId.party_fantasma = 5;
    }, /supportPercentByPartyId\/party_fantasma/);
  });
});
