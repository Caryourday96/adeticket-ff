export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={"brand " + (large ? "brand-large" : "")}>
      <strong>
        FRIENDS
        <br />
        SHOWDOWN
      </strong>
      <small>THE HOME GAME</small>
      <em className="alpha-badge" title="Alpha release — features are still being refined">
        ALPHA
      </em>
    </div>
  );
}
