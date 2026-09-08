import { filledButton, outlinedButton } from "@/features/brand/cta";

export function Closing() {
  return (
    <div className="pb-14 pt-16 min-[860px]:pb-20 min-[860px]:pt-24">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-[26px] px-[22px] min-[860px]:grid-cols-[1.1fr_0.9fr] min-[860px]:items-center min-[860px]:gap-[48px]">
        <div>
          <h2 className="headline-l text-balance text-on-surface">
            The dues are the easy part. The trust is the product.
          </h2>
          <p className="mt-3 max-w-[50ch] body-l text-on-surface-variant">
            {
              "Most association software loses residents at the first unexplained charge. claveHQ's answer is that every line traces back to a reading, a rate and a person — visible to the household that owes it, before they ask."
            }
          </p>
        </div>
        <div className="mt-[26px] flex flex-wrap gap-[10px]">
          <a href="#modules" className={filledButton}>
            Walk the modules
          </a>
          <a href="#amenities" className={`${outlinedButton} text-primary`}>
            See the amenity board
          </a>
        </div>
      </div>
    </div>
  );
}
