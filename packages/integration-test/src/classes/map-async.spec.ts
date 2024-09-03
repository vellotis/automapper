import { classes } from '@automapper/classes';
import {
    addProfile,
    afterMap,
    beforeMap,
    condition,
    convertUsing,
    createMap,
    createMapper,
    forMember,
    fromValue,
    ignore,
    mapDefer,
    mapFrom,
    Mapper,
    mapWith,
    nullSubstitution,
    undefinedSubstitution
} from '@automapper/core';
import { SimpleUserDto } from './dtos/simple-user.dto';
import { SimpleUser } from './models/simple-user';

async function asyncResolve<T>(value: T, delayMs = 1000): Promise<T> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(value);
        }, delayMs);
    });
}

const getFullname = (user: SimpleUser) => user.firstName + ' ' + user.lastName;

describe('Map Async Classes', () => {
    const mapper = createMapper({ strategyInitializer: classes() });

    beforeEach(() => mapper.dispose())

    it('should map async', async () => {
        createMap(
            mapper,
            SimpleUser,
            SimpleUserDto,
            forMember((d) => d.fullName, ignore()),
            beforeMap(async (source) => {
                source.firstName = await asyncResolve(source.firstName);
            }),
            afterMap(async (source, destination) => {
                const fullName = await asyncResolve(getFullname(source));

                Object.assign(destination, { fullName });
            })
        );

        const user = new SimpleUser('Chau', 'Tran');

        const dto = await mapper.mapAsync(
            user,
            SimpleUser,
            SimpleUserDto
        );
        expect(dto.fullName).toEqual(user.firstName + ' ' + user.lastName);
    });

    it('should map array async without calling afterMap', async () => {
      createMap(
          mapper,
          SimpleUser,
          SimpleUserDto,
          forMember((d) => d.fullName, ignore()),
          afterMap(async (source, destination) => {
              const fullName = await asyncResolve(getFullname(source));

              Object.assign(destination, { fullName });
          })
      );

      const user = new SimpleUser('Chau', 'Tran');

      const dtos = await mapper.mapArrayAsync(
          [user],
          SimpleUser,
          SimpleUserDto
      );

      expect(dtos).toHaveLength(1);
      expect(dtos[0].firstName).toEqual(user.firstName);
      expect(dtos[0].lastName).toEqual(user.lastName);
      expect(dtos[0].fullName).toEqual(undefined); // afterMap is not called
  });

  class Source {
      value?: string | null;
      another?: Source;
  }
  class Destination {
      value!: string;
      another?: Destination;
  }

  it('should resolve defer if Promise returned from the mapping', async () => {
      const mockValue = 'mockValue';
      addProfile(mapper, function profile(mapper) {
          createMap(mapper, Source, Destination,
              forMember((d) => d.value, mapDefer(() => Promise.resolve(fromValue(mockValue)))),
          )
      });

      const destination = await mapper.mapAsync({}, Source, Destination);

      expect(destination.value).toEqual(mockValue);
  });

  function prepareProfileForMemberMapFunction<
      MemberMapFunction extends (...arg: any[]) => any,
      MemberMapFunctionArgs extends Parameters<MemberMapFunction>
  >(memberMapFunction: MemberMapFunction, ...args: MemberMapFunctionArgs) {
      addProfile(mapper, function profile(mapper: Mapper) {
          createMap(mapper, Source, Destination,
              forMember((d) => d.value,  memberMapFunction(...args)),
          )
      });
  }

  function asynced(value: any) {
      return `asynced ${ value }`;
  }

  it('should resolve async `condition` and prevent mapping', async () => {
      prepareProfileForMemberMapFunction(condition, () => Promise.resolve(false));
      const source: Source = { value: condition.name };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(undefined);
  });

  it('should resolve async `condition` and perform mapping', async () => {
      prepareProfileForMemberMapFunction(condition, () => Promise.resolve(true));
      const source: Source = { value: condition.name };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(condition.name);
  });

  it('should resolve async `convertUsing`', async () => {
      prepareProfileForMemberMapFunction(convertUsing, {
          convert: (value) => Promise.resolve(asynced(value)),
      }, (source: Source) => source.value);
      const source: Source = { value: convertUsing.name };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(asynced(convertUsing.name));
  });

  it('should resolve async `fromValue`', async () => {
      prepareProfileForMemberMapFunction(fromValue, Promise.resolve(asynced(fromValue.name)));

      const destination = await mapper.mapAsync({}, Source, Destination);

      expect(destination.value).toEqual(asynced(fromValue.name));
  });

  it('should resolve async `mapDefer`', async () => {
      prepareProfileForMemberMapFunction(
          mapDefer,
          (source: Source) => Promise.resolve(fromValue(asynced(source.value)))
      );
      const source: Source = { value: mapDefer.name };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(asynced(mapDefer.name));
  });

  it('should resolve async `mapFrom`', async () => {
      prepareProfileForMemberMapFunction(mapFrom, (source: Source) => Promise.resolve(asynced(source.value)));
      const source: Source = {value: mapFrom.name};

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(asynced(mapFrom.name));
  });

  it('should resolve async `mapWith`', async () => {
      addProfile(mapper, function failingProfile(mapper) {
          createMap(mapper, Source, Destination,
              forMember((d) => d.value, mapFrom((source) => asynced(source.value))),
              forMember((d) => d.another, mapDefer(async (source) => {
                  return source.another
                      ? mapWith(Destination, Source, (source: Source) => Promise.resolve(source.another))
                      : ignore();
              }))
          )
      });
      const source: Source = {
          value: mapWith.name,
          another: {
              value: mapWith.name
          }
      };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(asynced(mapWith.name));
      expect(destination.another!.value).toEqual(asynced(mapWith.name));
      expect(destination.another!.another).toEqual(undefined);
  });

  it('should resolve async `nullSubstitution`', async () => {
      prepareProfileForMemberMapFunction(nullSubstitution, Promise.resolve(asynced(nullSubstitution.name)));
      const source: Source = { value: null };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(asynced(nullSubstitution.name));
  });

  it('should resolve async `undefinedSubstitution`', async () => {
      prepareProfileForMemberMapFunction(undefinedSubstitution, Promise.resolve(asynced(undefinedSubstitution.name)));
      const source: Source = { value: undefined };

      const destination = await mapper.mapAsync(source, Source, Destination);

      expect(destination.value).toEqual(asynced(undefinedSubstitution.name));
  });
});
