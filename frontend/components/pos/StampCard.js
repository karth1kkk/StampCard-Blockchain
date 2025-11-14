import { useMemo } from 'react';
import { STAMPS_PER_REWARD } from '../../lib/constants';

export default function StampCard({ 
  stampCount, 
  pendingRewards = 0, 
  rewardThreshold = STAMPS_PER_REWARD,
  cardsCompleted = 0,
  currentCardNumber = 1,
  lifetimeStamps = 0,
}) {
  const currentStamps = typeof stampCount === 'number' ? stampCount : Number(stampCount) || 0;
  const totalSlots = Number(rewardThreshold || STAMPS_PER_REWARD);
  const filledStamps = Math.min(currentStamps, totalSlots);
  const emptyStamps = totalSlots - filledStamps;
  const completedCards = Number(cardsCompleted || 0);
  const cardNum = Number(currentCardNumber || 1);

  const stampSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < filledStamps; i++) {
      slots.push({ filled: true, index: i });
    }
    for (let i = 0; i < emptyStamps; i++) {
      slots.push({ filled: false, index: filledStamps + i });
    }
    return slots;
  }, [filledStamps, emptyStamps]);

  const progressPercentage = useMemo(() => {
    return Math.min((currentStamps / totalSlots) * 100, 100);
  }, [currentStamps, totalSlots]);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-50 via-amber-100/50 to-amber-50 p-4 shadow-lg">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-amber-900">
            {completedCards > 0 ? (
              <>
                Card #{cardNum} {currentStamps >= totalSlots ? '(Complete)' : '(In Progress)'}
              </>
            ) : (
              'Coffee Loyalty Card'
            )}
          </h4>
          <p className="text-[10px] text-amber-700 mt-0.5">
            {currentStamps} / {totalSlots} stamps
            {completedCards > 0 && (
              <span className="ml-1 text-emerald-700">
                · {completedCards} card{completedCards !== 1 ? 's' : ''} completed
              </span>
            )}
          </p>
        </div>
        {pendingRewards > 0 && (
          <div className="rounded-full bg-emerald-500 px-2 py-0.5">
            <span className="text-[10px] font-bold text-white">
              {pendingRewards} Free{pendingRewards !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      
      {/* Completed Cards Summary */}
      {completedCards > 0 && (
        <div className="mb-3 rounded-lg bg-emerald-100/80 p-2 border border-emerald-300/50">
          <p className="text-[10px] font-semibold text-emerald-900 text-center">
            ✅ {completedCards} Card{completedCards !== 1 ? 's' : ''} Completed
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[10px] font-semibold text-amber-800">
          {currentStamps >= totalSlots
            ? 'Reward earned!'
            : `${totalSlots - currentStamps} more until reward`}
        </p>
      </div>

      {/* Stamp Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {stampSlots.map((slot, idx) => (
          <div
            key={idx}
            className={`relative flex aspect-square items-center justify-center rounded-lg border-2 transition-all ${
              slot.filled
                ? 'border-amber-600 bg-gradient-to-br from-amber-400 to-amber-600 shadow-md'
                : 'border-amber-300 bg-amber-50/50'
            }`}
          >
            {slot.filled ? (
              <svg
                className="h-6 w-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-amber-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-3 rounded-lg bg-amber-200/50 p-1.5 text-center">
        <p className="text-[10px] text-amber-800">
          {currentStamps >= totalSlots
            ? '🎉 Reward earned!'
            : `${totalSlots - currentStamps} more stamp${totalSlots - currentStamps !== 1 ? 's' : ''} needed`}
        </p>
      </div>
    </div>
  );
}

