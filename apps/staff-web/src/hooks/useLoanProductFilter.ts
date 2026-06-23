import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const PARAM = "productId";

export function useLoanProductFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedProductId = useMemo(() => {
    const raw = searchParams.get(PARAM);
    if (!raw || raw === "all") return null;
    return raw;
  }, [searchParams]);

  const setSelectedProductId = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!id) {
            next.delete(PARAM);
          } else {
            next.set(PARAM, id);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { selectedProductId, setSelectedProductId, paramKey: PARAM };
}
