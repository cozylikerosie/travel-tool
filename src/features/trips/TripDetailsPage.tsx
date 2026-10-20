import { ArrowLeft, BookOpen, CalendarDays, Download, Pencil, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatMoney } from "../../shared/money/budget";
import { getTripDurationDays, listTripDays, type TripDay } from "../../shared/dates/tripDates";
import {
  itineraryRepository as defaultItineraryRepository,
  type ItineraryRepository,
  type PlacesBeyondDay,
  type RemovedDaysResolution,
} from "../../data/itineraryRepository";
import { expenseRepository as defaultExpenseRepository, type ExpenseRepository } from "../../data/expenseRepository";
import {
  itineraryFileName,
  transferRepository as defaultTransferRepository,
  type TransferRepository,
} from "../../data/transferRepository";
import type { TripRepository } from "../../data/tripRepository";
import { FileImportButton } from "../../shared/files/FileImportButton";
import { downloadJson } from "../../shared/files/jsonFile";
import { ExpenseSummaryPanel } from "../expenses/ExpenseSummaryPanel";
import type { Expense } from "../expenses/expenseSchema";
import { CopyTripButton } from "./CopyTripButton";
import { DeleteTripDialog } from "./DeleteTripDialog";
import { RemovedDaysDialog } from "./RemovedDaysDialog";
import { TripForm } from "./TripForm";
import { saveTrip, type SaveTripResult } from "./saveTrip";
import { tripFormSchema, type Trip, type TripFormInput } from "./tripSchema";

interface TripDetailsPageProps {
  trip: Trip;
  repository: TripRepository;
  itineraryRepository?: ItineraryRepository;
  expenseRepository?: ExpenseRepository;
  transferRepository?: TransferRepository;
  onBack: () => void;
  onSaved: (trip: Trip) => void;
  onDeleted: (id: string) => Promise<void>;
  onCopy: (initialValues: TripFormInput) => void;
  onOpenItinerary: () => void;
  onOpenTravelMode: () => void;
  onOpenRecap: () => void;
}

export function TripDetailsPage({
  trip,
  repository,
  itineraryRepository = defaultItineraryRepository,
  expenseRepository = defaultExpenseRepository,
  transferRepository = defaultTransferRepository,
  onBack,
  onSaved,
  onDeleted,
  onCopy,
  onOpenItinerary,
  onOpenTravelMode,
  onOpenRecap,
}: TripDetailsPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    void expenseRepository.listForTrip(trip.id).then((saved) => {
      if (isCurrent) setExpenses(saved);
    });
    return () => {
      isCurrent = false;
    };
  }, [expenseRepository, trip.id]);

  async function handleExportItinerary() {
    setExportError("");
    try {
      downloadJson(itineraryFileName(trip), await transferRepository.exportItinerary(trip.id));
    } catch {
      setExportError("輸出失敗，請再試一次。");
    }
  }

  async function handleImportExpenses(text: string) {
    const result = await transferRepository.importExpenses(trip.id, text);
    setExpenses(await expenseRepository.listForTrip(trip.id));
    return `已匯入 ${result.added} 筆新花費${result.updated ? `，更新 ${result.updated} 筆` : ""}。`;
  }
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [removedDaysPrompt, setRemovedDaysPrompt] = useState<{
    beyond: PlacesBeyondDay;
    keptDays: TripDay[];
    resolve: (resolution: RemovedDaysResolution | null) => void;
  } | null>(null);

  // 旅程縮短且被移除的天有地點時，先讓使用者決定如何處理，再與旅程更新在同一交易內寫入
  async function saveWithRemovedDaysCheck(input: TripFormInput, existingTrip?: Trip): Promise<SaveTripResult> {
    const parsed = tripFormSchema.safeParse(input);
    if (!existingTrip || !parsed.success) return saveTrip(input, { existingTrip, repository });

    const oldDayCount = getTripDurationDays(existingTrip.startDate, existingTrip.endDate);
    const newDayCount = getTripDurationDays(parsed.data.startDate, parsed.data.endDate);
    if (newDayCount >= oldDayCount) return saveTrip(input, { existingTrip, repository });

    const beyond = await itineraryRepository.countPlacesBeyondDay(existingTrip.id, newDayCount);
    if (!beyond.placeCount) return saveTrip(input, { existingTrip, repository });

    const resolution = await new Promise<RemovedDaysResolution | null>((resolve) =>
      setRemovedDaysPrompt({
        beyond,
        keptDays: listTripDays(parsed.data.startDate, parsed.data.endDate),
        resolve,
      }),
    );
    setRemovedDaysPrompt(null);
    if (!resolution) {
      return { success: false, message: "已取消日期變更，旅程未修改。", fieldErrors: {} };
    }

    return saveTrip(input, {
      existingTrip,
      repository: {
        ...repository,
        update: (updatedTrip) => itineraryRepository.updateTripWithRemovedDays(updatedTrip, resolution),
      },
    });
  }

  if (isEditing) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-8 px-5 py-8 md:gap-12 md:px-12 md:py-12">
        <header className="grid gap-6 border-b border-rule pb-7">
          <button
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
            onClick={() => setIsEditing(false)}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            返回旅程
          </button>
          <div className="grid gap-2">
            <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
              EDIT JOURNEY
            </p>
            <h1 className="font-title text-4xl text-ink md:text-5xl">編輯旅程</h1>
          </div>
        </header>
        <TripForm
          initialTrip={trip}
          onCancel={() => setIsEditing(false)}
          onSaved={(updatedTrip) => {
            onSaved(updatedTrip);
            setIsEditing(false);
          }}
          save={saveWithRemovedDaysCheck}
        />
        {removedDaysPrompt && (
          <RemovedDaysDialog
            keptDays={removedDaysPrompt.keptDays}
            onCancel={() => removedDaysPrompt.resolve(null)}
            onResolve={(resolution) => removedDaysPrompt.resolve(resolution)}
            placeCount={removedDaysPrompt.beyond.placeCount}
            removedDayNumbers={removedDaysPrompt.beyond.dayNumbers}
          />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-10 px-5 py-8 md:gap-12 md:px-12 md:py-12">
      <header className="grid gap-6 border-b border-rule pb-7 md:pb-9">
        <button
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          返回旅程列表
        </button>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid gap-2">
            <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
              JOURNEY DETAILS
            </p>
            <h1 className="font-title text-4xl leading-tight text-ink md:text-5xl">
              {trip.name}
            </h1>
            <p className="text-base text-muted">{trip.destinations.join("・")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink bg-ink px-4 text-sm text-paper hover:bg-transparent hover:text-ink"
              onClick={onOpenItinerary}
              type="button"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              每日行程
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
              onClick={onOpenTravelMode}
              type="button"
            >
              <Smartphone aria-hidden="true" className="size-4" />
              旅途模式
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
              onClick={onOpenRecap}
              type="button"
            >
              <BookOpen aria-hidden="true" className="size-4" />
              旅程回顧
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
              onClick={() => void handleExportItinerary()}
              type="button"
            >
              <Download aria-hidden="true" className="size-4" />
              輸出行程檔
            </button>
            <CopyTripButton onCopy={onCopy} trip={trip} />
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              <Pencil aria-hidden="true" className="size-4" />
              編輯旅程
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 px-4 text-sm text-budget-over underline decoration-rule underline-offset-4"
              onClick={() => setIsDeleteOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              刪除旅程
            </button>
          </div>
        </div>
      </header>

      <section aria-label="旅程基本資訊" className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">DATES</p>
          <p className="font-display text-3xl text-ink">
            {trip.startDate.slice(5).replace("-", ".")} — {trip.endDate.slice(5).replace("-", ".")}
          </p>
          <p className="text-sm text-muted">{getTripDurationDays(trip.startDate, trip.endDate)} 天</p>
        </div>
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">BUDGET</p>
          <p className="font-display text-3xl tabular-nums text-ink">
            {trip.budgetAmountMinor !== null && trip.budgetCurrency
              ? formatMoney(trip.budgetAmountMinor, trip.budgetCurrency)
              : "未設定"}
          </p>
        </div>
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">COMPANIONS</p>
          <p className="text-base text-ink">{trip.companions.length ? trip.companions.join("、") : "未設定"}</p>
        </div>
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">NOTES</p>
          <p className="whitespace-pre-wrap text-base text-ink">{trip.notes || "未設定"}</p>
        </div>
      </section>

      {exportError && <p className="text-sm text-budget-over" role="alert">{exportError}</p>}

      <section aria-labelledby="expense-summary-title" className="grid gap-6 border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid gap-2">
            <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">EXPENSES</p>
            <h2 className="font-title text-3xl text-ink" id="expense-summary-title">花費結果</h2>
          </div>
          <FileImportButton label="匯入花費檔" onImport={handleImportExpenses} />
        </div>
        <ExpenseSummaryPanel expenses={expenses} trip={trip} />
      </section>

      <section className="grid gap-2 border-t border-rule pt-6 text-sm text-muted">
        <p className="font-label text-xs uppercase tracking-[0.15em]">HOW TO USE ON PHONE</p>
        <p>1. 按「輸出行程檔」，把檔案傳到手機（AirDrop、雲端硬碟或通訊軟體皆可）。</p>
        <p>2. 在手機開啟本網站，於首頁按「匯入行程檔」，再進入旅程按「旅途模式」。沒有網路時也能查看行程與記帳。</p>
        <p>3. 旅程結束後在手機按「匯出花費檔」，傳回電腦後在上方按「匯入花費檔」。</p>
      </section>

      {isDeleteOpen && (
        <DeleteTripDialog
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={() => onDeleted(trip.id)}
          tripName={trip.name}
        />
      )}
    </main>
  );
}