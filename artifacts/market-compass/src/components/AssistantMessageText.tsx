import type {ReactNode} from 'react';

/** Safe model emphasis: never interpret AI text as HTML or executable links. */
function inlineEmphasis(text:string):ReactNode[] {
  const pattern=/(\*\*[^*\n]+\*\*|__[^_\n]+__)/g;
  const output:ReactNode[]=[];
  let cursor=0;
  for(const match of text.matchAll(pattern)){
    const start=match.index??0;
    if(start>cursor)output.push(text.slice(cursor,start));
    output.push(<strong key={start} className="font-bold">{match[0].slice(2,-2)}</strong>);
    cursor=start+match[0].length;
  }
  if(cursor<text.length)output.push(text.slice(cursor));
  return output;
}

export default function AssistantMessageText({text}:{text:string}){
  return <span className="whitespace-pre-wrap break-words">{inlineEmphasis(text.replace(/\r\n?/g,'\n'))}</span>;
}
