export const lanesExample = `type: lanes
title: 상태 판정과 실제 사용 사이의 변경

columns:
  - 백그라운드 병합
  - 메인 스레드

rows:
  - [바깥 ScopeInfo 존재 여부 검사, null]
  - [기존 상태를 기준으로 참 판정, null]
  - [null, 같은 함수의 지연 컴파일 진행]
  - [null, SFI 필드의 값/의미 변경]
  - [별도 getter로 SFI 다시 조회, null]
  - [앞선 판정과 다른 상태 사용, null]

conclusion: >
  바깥 ScopeInfo로 해석해도 된다는 전제가
  실제 읽은 상태와 불일치
`;

export const flowExample = `type: flow
title: 요청 처리 흐름
direction: down

nodes:
  - id: request
    label: 요청 수신
  - id: cache
    label: 캐시 조회
  - id: origin
    label: 원본 데이터 조회
  - id: response
    label: 응답 반환

edges:
  - from: request
    to: cache
  - from: request
    to: origin
  - from: cache
    to: response
  - from: origin
    to: response
`;

export const longExample = `type: lanes
title: 긴 문장도 같은 행에 정렬됩니다
columns: [백그라운드 작업, 메인 스레드]
rows:
  - - 한글과 English, 숫자 1234가 섞인 긴 문장입니다. 글자가 많아지면 박스 안에서 줄을 바꾸고 같은 행의 높이를 함께 늘립니다.
    - null
  - - null
    - |-
      명시적인 줄바꿈도 유지합니다.
      두 번째 줄에서 상태를 변경합니다.
  - - VeryLongIdentifierWithoutAnySpaces_ScopeInfo_BackgroundMerge_SharedFunctionInfo_CompilationState
    - 처리 완료
conclusion: 공백으로 위치를 맞추지 않아도 글자와 테두리가 정렬됩니다.
`;

export function asMarkdown(source: string) {
  return '# 실행 순서 분석\n\n문서 안에서도 같은 다이어그램을 사용할 수 있습니다.\n\n```diagram\n' + source.trim() + '\n```\n\n## 확인할 내용\n\n- 위에서 아래로 실행 순서를 읽습니다.\n- 빈 칸은 해당 단계에 작업이 없음을 나타냅니다.\n';
}
export const sizedExample = `type: flow
title: 박스 크기를 직접 지정하세요
direction: down

defaults:
  width: 280
  minHeight: 80

nodes:
  - id: check
    label: 기본 크기의 박스
  - id: detail
    label: 이 박스는 너비 420px, 최소 높이 120px입니다. 내용이 더 길어지면 높이가 자동으로 늘어납니다.
    width: 420
    minHeight: 120
  - id: done
    label: 완료
    width: 160
    minHeight: 60

edges:
  - from: check
    to: detail
  - from: detail
    to: done
`;

export const labelsExample = `type: flow
title: 화살표 옆에 설명을 붙이세요
direction: down

defaults:
  width: 220

nodes:
  - id: update
    label: 32비트 상태 갱신
  - id: cache
    label: rcache 계산
  - id: output
    label: 출력 워드 저장
  - id: next
    label: 다음 반복

edges:
  - from: update
    to: cache
    label: 한 반복에서 두 번 호출
  - from: update
    to: output
    label: 출력에 사용
  - from: cache
    to: next
    label: |-
      다음 반복의
      r(m_w) 입력
`;

export const examples: Record<string, string> = { lanes: lanesExample, flow: flowExample, long: longExample, sized: sizedExample, labels: labelsExample };
