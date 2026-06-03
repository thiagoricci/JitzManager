import * as React from 'react';
import { useIMask } from 'react-imask';
import { Input } from '@/components/ui/input';

// The accepted mask shape mirrors the first argument of useIMask (IMask's FactoryArg).
type IMaskOptions = Parameters<typeof useIMask>[0];

type MaskedInputProps = Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> & {
  mask: IMaskOptions;
  value: string;
  onValueChange: (value: string) => void;
};

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onValueChange, ...props }, ref) => {
    const {
      ref: imaskRef,
      setValue,
    } = useIMask(mask, {
      onAccept: (acceptedValue) => {
        onValueChange(acceptedValue as string);
      },
    });

    React.useEffect(() => {
      setValue(value);
    }, [value, setValue]);

    const combinedRef = (node: HTMLInputElement | null) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      (imaskRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    return <Input {...props} ref={combinedRef} value={value} />;
  }
);

MaskedInput.displayName = 'MaskedInput';

export { MaskedInput };