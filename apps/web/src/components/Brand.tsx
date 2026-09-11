export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={"brand " + (large ? "brand-large" : "")}>
      <span>NAIJA</span>
      <strong>
        FAMILY
        <br />
        SHOWDOWN
      </strong>
      <small>THE HOME GAME</small>
    </div>
  );
}
