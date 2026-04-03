import Link from "next/link";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-[#08080d] text-white">
			<main className="flex flex-col items-center gap-8 px-6 text-center">
				<h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
					<span className="bg-gradient-to-r from-[#7c6aff] to-[#4ecdc4] bg-clip-text text-transparent">
						DreamRealm
					</span>
				</h1>

				<p className="max-w-lg text-lg text-zinc-400">
					텍스트 하나로 세계를 만들고, 턴제 어드벤처로 탐험하세요.
					<br />
					<span className="text-zinc-300 font-medium">
						세계가 당신을 기억합니다.
					</span>
				</p>

				<div className="flex flex-col gap-4 sm:flex-row">
					<Link
						href="/login"
						className="flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#7c6aff] to-[#4ecdc4] px-8 font-semibold text-white transition-opacity hover:opacity-90"
					>
						시작하기
					</Link>
					<Link
						href="/login"
						className="flex h-12 items-center justify-center rounded-full border border-zinc-700 px-8 font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
					>
						로그인
					</Link>
				</div>

				<div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
					<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-left">
						<div className="mb-3 text-2xl">🌍</div>
						<h3 className="mb-1 font-semibold">세계 생성</h3>
						<p className="text-sm text-zinc-500">
							장르와 설명만 입력하면 AI가 완전한 세계를 설계합니다
						</p>
					</div>
					<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-left">
						<div className="mb-3 text-2xl">⚔️</div>
						<h3 className="mb-1 font-semibold">턴제 탐험</h3>
						<p className="text-sm text-zinc-500">
							선택지를 고르거나 자유롭게 행동하며 이야기를 만들어가세요
						</p>
					</div>
					<div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-left">
						<div className="mb-3 text-2xl">🧠</div>
						<h3 className="mb-1 font-semibold">영속적 메모리</h3>
						<p className="text-sm text-zinc-500">
							NPC가 당신을 기억하고, 세계는 당신 없이도 흘러갑니다
						</p>
					</div>
				</div>
			</main>
		</div>
	);
}
