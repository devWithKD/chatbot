import { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => <h1 className="text-4xl font-bold">{props.children}</h1>,
    h2: (props) => <h2 className="text-2xl font-bold">{props.children}</h2>,
    h3: (props) => <h3 className="text-xl font-bold">{props.children}</h3>,
    ...components,
  };
}
