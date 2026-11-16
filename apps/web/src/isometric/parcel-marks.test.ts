import { describe, expect, it } from "vitest";

import { indexAssetStatus } from "../ui/asset-status";
import { PLAYER, RIVAL, auction, economy, loan, parcel } from "../ui/status-fixtures";
import { parcelMarkCell, parcelMarkPlan, reconcileParcelMarks } from "./parcel-marks";

describe("V.d-UX.S · placas de carga por parcela", () => {
  it("marca la parcela gravada y no la que está libre", () => {
    const e = economy({
      parcels: [parcel(), parcel({ id: "parcel_00000002" })],
      banking: { offers: [], loans: [loan()], auctions: [] },
    });
    const plan = parcelMarkPlan(e, indexAssetStatus(e));
    expect(plan).toHaveLength(1);
    expect(plan[0]!.parcelId).toBe("parcel_00000001");
    expect(plan[0]!.glyph).toBe("lien");
    expect(plan[0]!.tone).toBe("lien");
  });

  it("un edificio multi-parcela produce una placa por parcela gravada, no sólo la primera", () => {
    const e = economy({
      parcels: [parcel(), parcel({ id: "parcel_00000002" }), parcel({ id: "parcel_00000003" })],
      banking: {
        offers: [],
        auctions: [],
        loans: [
          loan({ id: "loan_00000001", collateralParcelId: "parcel_00000001" }),
          loan({
            id: "loan_00000002",
            collateralParcelId: "parcel_00000003",
            status: "delinquent",
          }),
        ],
      },
    });
    const plan = parcelMarkPlan(e, indexAssetStatus(e));
    expect(plan.map((entry) => entry.parcelId)).toEqual(["parcel_00000001", "parcel_00000003"]);
    expect(plan[1]!.tone).toBe("arrears");
  });

  it("la subasta propia y la puja en subasta ajena se marcan; lo ajeno sin puja no", () => {
    const own = economy({
      parcels: [parcel()],
      banking: { offers: [], loans: [loan({ status: "defaulted" })], auctions: [auction()] },
    });
    expect(parcelMarkPlan(own, indexAssetStatus(own))[0]!.kind).toBe("auction");

    const bid = economy({
      parcels: [parcel({ ownerOrganizationId: RIVAL })],
      banking: {
        offers: [],
        loans: [],
        auctions: [auction({ sellerOrganizationId: RIVAL, highestBidderOrganizationId: PLAYER })],
      },
    });
    const bidPlan = parcelMarkPlan(bid, indexAssetStatus(bid));
    expect(bidPlan).toHaveLength(1);
    expect(bidPlan[0]!.kind).toBe("auction_bid");
    expect(bidPlan[0]!.tone).toBe("opportunity");

    const foreign = economy({ parcels: [parcel({ ownerOrganizationId: RIVAL })] });
    expect(parcelMarkPlan(foreign, indexAssetStatus(foreign))).toEqual([]);
  });

  it("el anclaje es determinista y prefiere la esquina con frente de calle", () => {
    const withFrontage = parcel({
      cells: [
        { x: 12, y: 12 },
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ],
      roadFrontages: [
        {
          roadSegmentId: "road_1",
          cells: [
            { x: 11, y: 10 },
            { x: 12, y: 12 },
          ],
        },
      ],
    });
    expect(parcelMarkCell(withFrontage)).toEqual({ x: 11, y: 10 });
    expect(parcelMarkCell(withFrontage)).toEqual(parcelMarkCell(withFrontage));
    const without = parcel({
      cells: [
        { x: 12, y: 12 },
        { x: 10, y: 10 },
      ],
    });
    expect(parcelMarkCell(without)).toEqual({ x: 10, y: 10 });
  });

  it("la reconciliación es idempotente y elimina lo que sale del plan", () => {
    const e = economy({
      parcels: [parcel()],
      banking: { offers: [], loans: [loan()], auctions: [] },
    });
    const plan = parcelMarkPlan(e, indexAssetStatus(e));
    const first = reconcileParcelMarks(new Map(), plan);
    expect(first.created).toHaveLength(1);
    expect(first.removed).toEqual([]);
    const second = reconcileParcelMarks(first.next, plan);
    expect(second.created).toEqual([]);
    expect(second.removed).toEqual([]);
    const third = reconcileParcelMarks(second.next, []);
    expect(third.removed).toEqual([...second.next.keys()]);
    expect(third.next.size).toBe(0);
  });

  it("sin proyección no hay placas", () => {
    expect(parcelMarkPlan(undefined, indexAssetStatus(undefined))).toEqual([]);
  });
});
