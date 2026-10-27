export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="container space-y-4 py-10">
      <div className="skeleton h-10 w-2/3 sm:w-1/3" />
      <div className="skeleton h-64 w-full rounded-2xl" />
      <div className="skeleton h-5 w-1/2" />
    </div>
  );
}
