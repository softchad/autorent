import {
  useGetAllSupportsQuery,
  useAnswerToSupportMutation,
} from "@/store/enhanceEndpoints";

export const useSupportData = () => {
  const { data: supports = [], isLoading, refetch } = useGetAllSupportsQuery();
  const [answerToSupport, { isLoading: isAnswering }] = useAnswerToSupportMutation();

  const answer = async (id: number, atsakymas: string) => {
    await answerToSupport({
      uzklausosId: id,
      clientSupportUpdate: {
        atsakymas,
        atsakymo_data: new Date().toISOString(),
      },
    }).unwrap();
    await refetch();
  };

  return {
    supports,
    isLoading: isLoading || isAnswering,
    answer,
  };
};
